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
    return usersWithRelations.map(mapUserFromDB).sort((a: User, b: User) => b.score - a.score);
  }
  
  if (!data || data.length === 0) {
      // If table exists but empty, seed it (Supabase only)
      await seedInitialData();
      return getUsers();
  }

  return data.map(mapUserFromDB);
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

export const loginOrCreateUser = async (name: string): Promise<User> => {
  // Try Supabase
  // Here we select * (including password) because we need to verify credentials
  const { data, error } = await supabase
    .from('users')
    .select(`*, check_ins(*, comments(*))`)
    .ilike('name', name)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 is "Row not found" (which is fine, we create), others are errors
      console.warn("Supabase Login Error (using local):", error.message);
      // FALLBACK
      const db = getLocalDB();
      let localUser = db.users.find((u: any) => u.name.toLowerCase() === name.toLowerCase());
      
      if (!localUser) {
          // Create local
          localUser = {
            id: Date.now().toString(),
            name: name,
            avatar_seed: Math.floor(Math.random() * 1000),
            score: 0,
            streak: 0,
            custom_avatar: null,
            password: null
          };
          db.users.push(localUser);
          saveLocalDB(db);
      }
      
      // Join Checkins & Notifications for return
      const uCheckIns = db.check_ins.filter((c: any) => c.user_id === localUser.id).map((c: any) => ({
            ...c,
            comments: db.comments.filter((cm: any) => cm.check_in_id === c.id)
      }));
      const uNotifs = db.notifications.filter((n: any) => n.user_id === localUser.id);
      
      return mapUserFromDB({ ...localUser, check_ins: uCheckIns, notifications: uNotifs });
  }

  if (data) {
    // Supabase success
    const { data: notifs } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', data.id);

    const user = mapUserFromDB(data);
    user.notifications = notifs ? notifs.map(mapNotificationFromDB) : [];
    return user;
  }

  // Create if not exists (Supabase)
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

  if (createError || !created) {
      throw new Error('Error creating user');
  }

  return mapUserFromDB(created);
};

export const performCheckIn = async (userId: string, photoBase64: string, caption: string = ''): Promise<User | null> => {
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
      db.users.forEach((other: any) => {
          if (other.id !== userId) {
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

  // Provocation
  const { data: allUsers } = await supabase.from('users').select('id, name, score');
  if (allUsers) {
      const oldScore = userDB.score || 0;
      for (const other of allUsers) {
          if (other.id !== userId) {
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
    // Try Supabase
    const { data: checkIns, error } = await supabase
        .from('check_ins')
        .select(`
            *,
            comments (*),
            users (id, name, avatar_seed, custom_avatar)
        `)
        .order('timestamp', { ascending: false });
    
    if (error) {
        console.warn("Supabase feed error (using local):", error.message);
        // FALLBACK
        const db = getLocalDB();
        const combined = db.check_ins.map((c: any) => {
            const u = db.users.find((user: any) => user.id === c.user_id);
            const comments = db.comments.filter((cm: any) => cm.check_in_id === c.id);
            return {
                ...c,
                comments: comments,
                users: u // Structure matches Supabase response shape for mapper below
            };
        }).sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        return combined.map((row: any) => ({
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
    }

    if (!checkIns) return [];

    return checkIns.map((row: any) => ({
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