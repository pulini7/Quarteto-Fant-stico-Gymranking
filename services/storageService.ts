import { User, CheckIn, Comment, Notification } from '../types';
import { supabase } from './supabaseClient';

// Helper to get today's date string YYYY-MM-DD
export const getTodayString = (): string => {
  return new Date().toISOString().split('T')[0];
};

// Helper to check if a date string is Saturday (6) or Sunday (0)
export const isWeekend = (dateString: string): boolean => {
  const d = new Date(`${dateString}T12:00:00`);
  const day = d.getDay();
  return day === 0 || day === 6;
};

// --- Security / Filtering Helpers ---
const TEST_USER_EMAIL = 'vitor_pulini@hotmail.com';
const HIDDEN_NAMES = [TEST_USER_EMAIL, 'administrador', 'admin'];

const isHiddenUser = (name: string): boolean => {
    if (!name) return false;
    return HIDDEN_NAMES.some(hidden => hidden.toLowerCase() === name.toLowerCase());
};

// --- Cleanup Helper for Test User ---
const TEST_USER_TTL_MS = 10 * 60 * 1000; // 10 minutes

const cleanupExpiredTestCheckIns = async () => {
    // 1. Calculate Cutoff Time
    const cutoffDate = new Date(Date.now() - TEST_USER_TTL_MS);
    const cutoffISO = cutoffDate.toISOString();

    // 2. Find Test User ID (Supabase)
    const { data: user } = await supabase
        .from('users')
        .select('id')
        .ilike('name', TEST_USER_EMAIL)
        .single();

    if (user) {
        // Delete Check-ins older than 10 mins for this user
        await supabase
            .from('check_ins')
            .delete()
            .eq('user_id', user.id)
            .lt('timestamp', cutoffISO);
            
        // Note: Comments cascade delete via SQL usually, but if not, they remain orphaned or handled by RLS.
    }

    // 3. Fallback Local Storage Cleanup
    const db = getLocalDB();
    const localUser = db.users.find((u: any) => u.name.toLowerCase() === TEST_USER_EMAIL.toLowerCase());
    
    if (localUser) {
        const initialLength = db.check_ins.length;
        db.check_ins = db.check_ins.filter((c: any) => {
            if (c.user_id !== localUser.id) return true;
            const cDate = new Date(c.timestamp);
            return cDate > cutoffDate; // Keep if newer than cutoff
        });
        
        if (db.check_ins.length !== initialLength) {
            saveLocalDB(db);
        }
    }
};

// --- Local Storage Fallback Helpers ---

const LOCAL_DB_KEY = 'gymrank_supa_fallback_v1';

const getLocalDB = () => {
    const stored = localStorage.getItem(LOCAL_DB_KEY);
    if (stored) return JSON.parse(stored);
    
    // Initial Seed for Local Mode
    const initial = {
        users: [
             { id: '1', name: 'Aline', avatar_seed: 501, score: 0, streak: 0, custom_avatar: null, password: null },
             { id: '2', name: 'Samila', avatar_seed: 502, score: 0, streak: 0, custom_avatar: null, password: null },
             { id: '3', name: 'Pâmela', avatar_seed: 503, score: 0, streak: 0, custom_avatar: null, password: null },
             { id: '4', name: 'Taís', avatar_seed: 504, score: 0, streak: 0, custom_avatar: null, password: null }
        ],
        check_ins: [],
        comments: [],
        notifications: []
    };
    localStorage.setItem(LOCAL_DB_KEY, JSON.stringify(initial));
    return initial;
};

const saveLocalDB = (db: any) => {
    localStorage.setItem(LOCAL_DB_KEY, JSON.stringify(db));
};

// --- Data Mapping Helpers ---

const mapCheckInFromDB = (dbCheckIn: any): CheckIn => ({
  id: dbCheckIn.id,
  date: dbCheckIn.date,
  timestamp: dbCheckIn.timestamp,
  photo: dbCheckIn.photo,
  likes: dbCheckIn.likes || [],
  caption: dbCheckIn.caption || '',
  comments: dbCheckIn.comments ? dbCheckIn.comments.map(mapCommentFromDB) : []
});

const mapCommentFromDB = (dbComment: any): Comment => ({
  id: dbComment.id,
  userId: dbComment.user_id,
  text: dbComment.text,
  timestamp: dbComment.timestamp
});

const mapNotificationFromDB = (dbNotif: any): Notification => ({
  id: dbNotif.id,
  type: dbNotif.type as 'OVERTAKE',
  message: dbNotif.message,
  fromUserId: dbNotif.from_user_id,
  timestamp: dbNotif.timestamp,
  read: dbNotif.read
});

const mapUserFromDB = (dbUser: any): User => ({
  id: dbUser.id,
  name: dbUser.name,
  avatarSeed: dbUser.avatar_seed,
  customAvatar: dbUser.custom_avatar,
  score: dbUser.score,
  streak: dbUser.streak,
  password: dbUser.password,
  // Relations are handled based on what's passed
  checkIns: dbUser.check_ins ? dbUser.check_ins.map(mapCheckInFromDB) : [],
  notifications: dbUser.notifications ? dbUser.notifications.map(mapNotificationFromDB) : []
});

// --- Core Functions ---

// Fetch users for PUBLIC display (Leaderboard, Profiles grid)
// Must filter out hidden users
export const getUsers = async (): Promise<User[]> => {
  // Try Supabase first
  // SECURITY UPDATE: We explicitly select columns to EXCLUDE 'password'.
  const { data, error } = await supabase
    .from('users')
    .select(`
      id, name, avatar_seed, custom_avatar, score, streak,
      check_ins (
        *,
        comments (*)
      )
    `)
    .order('score', { ascending: false });

  let users: User[] = [];

  if (error) {
    console.warn('Supabase error (switching to local):', error.message);
    // FALLBACK
    const db = getLocalDB();
    // Simulate Join
    const usersWithRelations = db.users.map((u: any) => {
        const uCheckIns = db.check_ins.filter((c: any) => c.user_id === u.id).map((c: any) => ({
            ...c,
            comments: db.comments.filter((cm: any) => cm.check_in_id === c.id)
        }));
        return { ...u, check_ins: uCheckIns };
    });
    users = usersWithRelations.map(mapUserFromDB).sort((a: User, b: User) => b.score - a.score);
  } else if (!data || data.length === 0) {
      // If table exists but empty, seed it (Supabase only)
      await seedInitialData();
      return getUsers();
  } else {
      users = data.map(mapUserFromDB);
  }

  // ANONYMITY FILTER: Remove hidden users from the public list
  return users.filter(u => !isHiddenUser(u.name));
};

const seedInitialData = async () => {
    const seedUsers = [
        { id: '1', name: 'Aline', avatar_seed: 501, score: 0, streak: 0 },
        { id: '2', name: 'Samila', avatar_seed: 502, score: 0, streak: 0 },
        { id: '3', name: 'Pâmela', avatar_seed: 503, score: 0, streak: 0 },
        { id: '4', name: 'Taís', avatar_seed: 504, score: 0, streak: 0 }
    ];
    await supabase.from('users').upsert(seedUsers);
}

// NEW: Delete User Function
export const deleteUser = async (userId: string): Promise<void> => {
    // 1. Delete Notifications
    await supabase.from('notifications').delete().eq('user_id', userId);
    await supabase.from('notifications').delete().eq('from_user_id', userId);
    
    // 2. Delete Comments
    await supabase.from('comments').delete().eq('user_id', userId);
    
    // 3. Delete CheckIns (Comments on these checkins will cascade if SQL configured, else manual)
    await supabase.from('check_ins').delete().eq('user_id', userId);
    
    // 4. Delete User
    const { error } = await supabase.from('users').delete().eq('id', userId);

    // Fallback Local Storage Cleanup
    const db = getLocalDB();
    if (db.users.some((u: any) => u.id === userId)) {
        db.users = db.users.filter((u: any) => u.id !== userId);
        db.check_ins = db.check_ins.filter((c: any) => c.user_id !== userId);
        db.comments = db.comments.filter((c: any) => c.user_id !== userId);
        db.notifications = db.notifications.filter((n: any) => n.user_id !== userId && n.from_user_id !== userId);
        saveLocalDB(db);
    }

    if (error) console.error("Error deleting user:", error);
};

export const saveUser = async (user: User): Promise<void> => {
    // Try Supabase
    const { error } = await supabase.from('users').update({
        custom_avatar: user.customAvatar,
        password: user.password
    }).eq('id', user.id);

    if (error) {
        // FALLBACK
        const db = getLocalDB();
        const index = db.users.findIndex((u: any) => u.id === user.id);
        if (index !== -1) {
            db.users[index].custom_avatar = user.customAvatar;
            db.users[index].password = user.password;
            saveLocalDB(db);
        }
    }
};

// Internal function to check if user exists (used for Login)
// This DOES NOT filter hidden users, allowing them to login.
export const getUserByName = async (name: string): Promise<User | null> => {
  // Try Supabase
  const { data, error } = await supabase
    .from('users')
    .select(`*, check_ins(*, comments(*))`)
    .ilike('name', name)
    .single();

  if (error || !data) {
      // FALLBACK Check
      const db = getLocalDB();
      const localUser = db.users.find((u: any) => u.name.toLowerCase() === name.toLowerCase());
      
      if (!localUser) return null;

      // Join data for fallback
      const uCheckIns = db.check_ins.filter((c: any) => c.user_id === localUser.id).map((c: any) => ({
            ...c,
            comments: db.comments.filter((cm: any) => cm.check_in_id === c.id)
      }));
      const uNotifs = db.notifications.filter((n: any) => n.user_id === localUser.id);
      
      return mapUserFromDB({ ...localUser, check_ins: uCheckIns, notifications: uNotifs });
  }

  // Supabase Success
  const { data: notifs } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', data.id);

  const user = mapUserFromDB(data);
  user.notifications = notifs ? notifs.map(mapNotificationFromDB) : [];
  return user;
};

export const loginOrCreateUser = async (name: string): Promise<User> => {
  // Try to find first
  const existing = await getUserByName(name);
  if (existing) return existing;

  // If not found, create (Supabase)
  const newUser = {
    id: Date.now().toString(),
    name: name,
    avatar_seed: Math.floor(Math.random() * 1000),
    score: 0,
    streak: 0
  };

  const { data: created, error: createError } = await supabase
    .from('users')
    .insert(newUser)
    .select()
    .single();

  if (createError) {
      // Fallback create
      const db = getLocalDB();
      const localUser = {
        ...newUser,
        custom_avatar: null,
        password: null
      };
      db.users.push(localUser);
      saveLocalDB(db);
      return mapUserFromDB(localUser);
  }

  return mapUserFromDB(created!);
};

export const performCheckIn = async (userId: string, photoBase64: string, caption: string = ''): Promise<User | null> => {
  // Trigger Cleanup for Test User every time ANY check-in happens (keeps DB clean)
  await cleanupExpiredTestCheckIns();

  const today = getTodayString();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  // Logic reused for both DB and Local
  const calculateNewStats = (currentScore: number, currentStreak: number, hasCheckInYesterday: boolean) => {
      let newStreak = 1;
      if (hasCheckInYesterday) {
          newStreak = currentStreak + 1;
      }
      const pointsEarned = isWeekend(today) ? 20 : 10;
      const newScore = currentScore + pointsEarned;
      return { newScore, newStreak };
  };

  // Try Supabase
  const { data: userDB, error: fetchError } = await supabase.from('users').select('*, check_ins(*)').eq('id', userId).single();
  
  // IF SUPABASE FAIL
  if (fetchError) {
      const db = getLocalDB();
      const user = db.users.find((u: any) => u.id === userId);
      if (!user) return null;

      const userCheckIns = db.check_ins.filter((c: any) => c.user_id === userId);
      if (userCheckIns.some((c: any) => c.date === today)) {
          return await loginOrCreateUser(user.name);
      }

      const hasYesterday = userCheckIns.some((c: any) => c.date === yesterdayStr);
      const { newScore, newStreak } = calculateNewStats(user.score || 0, user.streak || 0, hasYesterday);

      // Save Checkin
      const newCheckIn = {
          id: Date.now().toString(),
          user_id: userId,
          date: today,
          timestamp: new Date().toISOString(),
          photo: photoBase64,
          caption: caption,
          likes: []
      };
      db.check_ins.push(newCheckIn);

      // Update User
      user.score = newScore;
      user.streak = newStreak;

      // Notifications (Provocation)
      // FILTER: Only generate notifications if current user is NOT hidden
      if (!isHiddenUser(user.name)) {
          db.users.forEach((other: any) => {
            // FILTER: Don't notify hidden users
            if (other.id !== userId && !isHiddenUser(other.name)) {
                if (other.score >= (user.score - (isWeekend(today) ? 20 : 10)) && other.score < newScore) {
                    db.notifications.push({
                        id: Date.now().toString() + Math.random(),
                        type: 'OVERTAKE',
                        user_id: other.id,
                        from_user_id: userId,
                        message: `${user.name} ultrapassou você hoje. Vai deixar?`,
                        timestamp: new Date().toISOString(),
                        read: false
                    });
                }
            }
          });
      }

      saveLocalDB(db);
      return await loginOrCreateUser(user.name);
  }

  // SUPABASE SUCCESS FLOW
  if (!userDB) return null;

  const hasCheckInToday = userDB.check_ins.some((c: any) => c.date === today);
  if (hasCheckInToday) return await loginOrCreateUser(userDB.name);

  const hasCheckInYesterday = userDB.check_ins.some((c: any) => c.date === yesterdayStr);
  const { newScore, newStreak } = calculateNewStats(userDB.score || 0, userDB.streak || 0, hasCheckInYesterday);

  const { error: checkInError } = await supabase.from('check_ins').insert({
      id: Date.now().toString(),
      user_id: userId,
      date: today,
      timestamp: new Date().toISOString(),
      photo: photoBase64,
      caption: caption,
      likes: []
  });

  if (checkInError) {
      console.error(checkInError);
      return null;
  }

  await supabase.from('users').update({
      score: newScore,
      streak: newStreak
  }).eq('id', userId);

  // Provocation Logic
  // FILTER: Only generate notifications if current user is NOT hidden
  if (!isHiddenUser(userDB.name)) {
      const { data: allUsers } = await supabase.from('users').select('id, name, score');
      if (allUsers) {
          const oldScore = userDB.score || 0;
          for (const other of allUsers) {
              // FILTER: Don't notify hidden users
              if (other.id !== userId && !isHiddenUser(other.name)) {
                  if (other.score >= oldScore && other.score < newScore) {
                      await supabase.from('notifications').insert({
                          id: Date.now().toString() + Math.random(),
                          type: 'OVERTAKE',
                          user_id: other.id,
                          from_user_id: userId,
                          message: `${userDB.name} ultrapassou você hoje. Vai deixar?`,
                          timestamp: new Date().toISOString(),
                          read: false
                      });
                  }
              }
          }
      }
  }

  return await loginOrCreateUser(userDB.name);
};

export const addComment = async (checkInId: string, userId: string, text: string): Promise<void> => {
    // Try Supabase
    const { error } = await supabase.from('comments').insert({
        id: Date.now().toString(),
        check_in_id: checkInId,
        user_id: userId,
        text: text,
        timestamp: new Date().toISOString()
    });

    if (error) {
        // FALLBACK
        const db = getLocalDB();
        db.comments.push({
            id: Date.now().toString(),
            check_in_id: checkInId,
            user_id: userId,
            text: text,
            timestamp: new Date().toISOString()
        });
        saveLocalDB(db);
    }
}

export const clearNotifications = async (userId: string): Promise<User | null> => {
    // Try Supabase
    const { error } = await supabase.from('notifications').delete().eq('user_id', userId);
    
    if (error) {
        // FALLBACK
        const db = getLocalDB();
        db.notifications = db.notifications.filter((n: any) => n.user_id !== userId);
        saveLocalDB(db);
        return await loginOrCreateUser((db.users.find((u: any) => u.id === userId) as any).name);
    }

    const { data } = await supabase
        .from('users')
        .select(`*, check_ins(*, comments(*))`)
        .eq('id', userId)
        .single();
        
    if (!data) return null;
    
    const user = mapUserFromDB(data);
    user.notifications = [];
    return user;
}

export const getAllCheckIns = async () => {
    // SECURITY: Ensure expired test data is gone before loading feed
    await cleanupExpiredTestCheckIns();

    // 1. Need to fetch ALL users first to identify IDs of hidden users for filtering likes/comments
    // We cannot trust mapUserFromDB filtering here because we need the raw IDs for the filter
    const { data: allUsersRaw } = await supabase.from('users').select('id, name');
    
    // List of IDs that are hidden
    const hiddenUserIds = allUsersRaw 
        ? allUsersRaw.filter((u: any) => isHiddenUser(u.name)).map((u: any) => u.id)
        : [];

    // Try Supabase
    const { data: checkIns, error } = await supabase
        .from('check_ins')
        .select(`
            *,
            comments (*),
            users (id, name, avatar_seed, custom_avatar)
        `)
        .order('timestamp', { ascending: false });
    
    let result = [];

    if (error) {
        console.warn("Supabase feed error (using local):", error.message);
        // FALLBACK
        const db = getLocalDB();
        
        // Local hidden IDs
        const localHiddenIds = db.users.filter((u: any) => isHiddenUser(u.name)).map((u: any) => u.id);

        const combined = db.check_ins.map((c: any) => {
            const u = db.users.find((user: any) => user.id === c.user_id);
            const comments = db.comments.filter((cm: any) => cm.check_in_id === c.id);
            return {
                ...c,
                comments: comments,
                users: u 
            };
        }).sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        result = combined.map((row: any) => ({
            user: {
                id: row.users.id,
                name: row.users.name,
                avatarSeed: row.users.avatar_seed,
                customAvatar: row.users.custom_avatar,
                checkIns: [],
                streak: 0,
                score: 0
            } as User,
            checkIn: mapCheckInFromDB(row)
        }));

        // FILTER LOCAL
        result = result.filter((item: any) => !isHiddenUser(item.user.name));
        // Filter Likes and Comments in Local
        result.forEach((item: any) => {
             item.checkIn.likes = item.checkIn.likes.filter((id: string) => !localHiddenIds.includes(id));
             item.checkIn.comments = item.checkIn.comments.filter((c: Comment) => !localHiddenIds.includes(c.userId));
        });

        return result;
    }

    if (!checkIns) return [];

    result = checkIns.map((row: any) => ({
        user: {
            id: row.users.id,
            name: row.users.name,
            avatarSeed: row.users.avatar_seed,
            customAvatar: row.users.custom_avatar,
            checkIns: [], 
            streak: 0,
            score: 0
        } as User,
        checkIn: mapCheckInFromDB(row)
    }));

    // ANONYMITY FILTER (FEED):
    // 1. Filter out posts (CheckIns) from hidden users
    result = result.filter((item: any) => !isHiddenUser(item.user.name));

    // 2. Filter out interactions (Likes and Comments) from hidden users on displayed posts
    result.forEach((item: any) => {
        // Filter Likes
        if (item.checkIn.likes && item.checkIn.likes.length > 0) {
            item.checkIn.likes = item.checkIn.likes.filter((userId: string) => !hiddenUserIds.includes(userId));
        }
        
        // Filter Comments
        if (item.checkIn.comments && item.checkIn.comments.length > 0) {
            item.checkIn.comments = item.checkIn.comments.filter((comment: Comment) => !hiddenUserIds.includes(comment.userId));
        }
    });

    return result;
};

export const toggleCheckInLike = async (checkInId: string, currentUserId: string): Promise<void> => {
    // Try Supabase
    const { data, error } = await supabase.from('check_ins').select('likes').eq('id', checkInId).single();
    
    if (error) {
        // FALLBACK
        const db = getLocalDB();
        const checkIn = db.check_ins.find((c: any) => c.id === checkInId);
        if (checkIn) {
            let likes: string[] = checkIn.likes || [];
            if (likes.includes(currentUserId)) {
                likes = likes.filter(id => id !== currentUserId);
            } else {
                likes.push(currentUserId);
            }
            checkIn.likes = likes;
            saveLocalDB(db);
        }
        return;
    }

    let likes: string[] = data.likes || [];
    if (likes.includes(currentUserId)) {
        likes = likes.filter(id => id !== currentUserId);
    } else {
        likes.push(currentUserId);
    }

    await supabase.from('check_ins').update({ likes }).eq('id', checkInId);
};