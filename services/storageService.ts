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
const HIDDEN_NAMES = ['administrador', 'admin', 'vitor_pulini@hotmail.com']; 

const isHiddenUser = (name: string): boolean => {
    if (!name) return false;
    return HIDDEN_NAMES.some(hidden => hidden.toLowerCase() === name.toLowerCase());
};

// --- Cleanup Helper for Test User ---
const TEST_USER_TTL_MS = 10 * 60 * 1000; // 10 minutes

const cleanupExpiredTestCheckIns = async () => {
    try {
        const cutoffDate = new Date(Date.now() - TEST_USER_TTL_MS);
        const cutoffISO = cutoffDate.toISOString();
        const { data: user } = await supabase.from('users').select('id').ilike('name', 'UsuarioTesteTemporario').single();
        if (user) {
            await supabase.from('check_ins').delete().eq('user_id', user.id).lt('timestamp', cutoffISO);
        }
    } catch (e) {
        console.warn("Cleanup error (background):", e);
    }
};

// --- Local Storage Fallback Helpers ---

const LOCAL_DB_KEY = 'gymrank_supa_fallback_v1';

const getLocalDB = () => {
    const stored = localStorage.getItem(LOCAL_DB_KEY);
    if (stored) return JSON.parse(stored);
    
    const initial = {
        users: [
             { id: '1', name: 'Aline', avatar_seed: 501, score: 0, streak: 0, custom_avatar: null, password: null, weekly_plan: {} },
             { id: '2', name: 'Samila', avatar_seed: 502, score: 0, streak: 0, custom_avatar: null, password: null, weekly_plan: {} },
             { id: '3', name: 'Pâmela', avatar_seed: 503, score: 0, streak: 0, custom_avatar: null, password: null, weekly_plan: {} },
             { id: '4', name: 'Taís', avatar_seed: 504, score: 0, streak: 0, custom_avatar: null, password: null, weekly_plan: {} }
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
  photo: dbCheckIn.photo || '', 
  videos: dbCheckIn.videos || [],
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
  weeklyPlan: dbUser.weekly_plan || {},
  checkIns: dbUser.check_ins ? dbUser.check_ins.map(mapCheckInFromDB) : [],
  notifications: dbUser.notifications ? dbUser.notifications.map(mapNotificationFromDB) : []
});

// --- Core Functions ---

export const resetGlobalRanking = async (): Promise<void> => {
    // Reseta o score E O STREAK de TODOS os usuários para 0 no Supabase
    await supabase.from('users').update({ score: 0, streak: 0 }).neq('id', '0'); 

    // Reseta local também para refletir na hora
    const db = getLocalDB();
    db.users.forEach((u: any) => { u.score = 0; u.streak = 0; });
    saveLocalDB(db);
};

export const resetUserByName = async (name: string): Promise<boolean> => {
    const db = getLocalDB();
    const localUserIndex = db.users.findIndex((u: any) => u.name.toLowerCase() === name.toLowerCase());
    if (localUserIndex !== -1) {
        const userId = db.users[localUserIndex].id;
        db.check_ins = db.check_ins.filter((c: any) => c.user_id !== userId);
        db.comments = db.comments.filter((c: any) => c.user_id !== userId);
        db.notifications = db.notifications.filter((n: any) => n.user_id !== userId && n.from_user_id !== userId);
        db.users[localUserIndex].score = 0;
        db.users[localUserIndex].streak = 0;
        saveLocalDB(db);
    }

    const { data: user } = await supabase.from('users').select('id').ilike('name', name).single();
    if (user) {
         await supabase.from('notifications').delete().eq('user_id', user.id);
         await supabase.from('notifications').delete().eq('from_user_id', user.id);
         await supabase.from('comments').delete().eq('user_id', user.id);
         await supabase.from('check_ins').delete().eq('user_id', user.id);
         await supabase.from('users').update({ score: 0, streak: 0 }).eq('id', user.id);
         return true;
    }
    
    return localUserIndex !== -1;
};

export const getUsersLight = async (): Promise<User[]> => {
    const { data, error } = await supabase
        .from('users')
        .select('id, name, avatar_seed, custom_avatar, password, streak, score, weekly_plan'); 

    if (error || !data) {
        return getUsers();
    }
    
    const users: User[] = data.map((u: any) => ({
        id: u.id,
        name: u.name,
        avatarSeed: u.avatar_seed,
        customAvatar: u.custom_avatar,
        password: u.password,
        streak: u.streak,
        score: u.score,
        weeklyPlan: u.weekly_plan || {},
        checkIns: [],
        notifications: []
    }));

    return users.filter(u => !isHiddenUser(u.name));
}

export const getLeaderboardData = async (): Promise<User[]> => {
    const { data, error } = await supabase
        .from('users')
        .select(`
            id, name, avatar_seed, custom_avatar, score, streak,
            check_ins (id, date)
        `)
        .order('score', { ascending: false });

    if (error) return getUsers(); 

    const users = data.map((u: any) => ({
        ...mapUserFromDB(u),
        checkIns: u.check_ins.map((c: any) => ({ id: c.id, date: c.date, photo: '', timestamp: '', likes: [], videos: [] }))
    }));

    return users.filter(u => !isHiddenUser(u.name));
}

export const getUsers = async (): Promise<User[]> => {
  const { data, error } = await supabase
    .from('users')
    .select(`
      id, name, avatar_seed, custom_avatar, score, streak, weekly_plan,
      check_ins (
        *,
        comments (*)
      )
    `)
    .order('score', { ascending: false });

  let users: User[] = [];

  if (error) {
    console.warn('Supabase error (switching to local):', error.message);
    const db = getLocalDB();
    const usersWithRelations = db.users.map((u: any) => {
        const uCheckIns = db.check_ins.filter((c: any) => c.user_id === u.id).map((c: any) => ({
            ...c,
            comments: db.comments.filter((cm: any) => cm.check_in_id === c.id)
        }));
        return { ...u, check_ins: uCheckIns };
    });
    users = usersWithRelations.map(mapUserFromDB).sort((a: User, b: User) => b.score - a.score);
  } else if (!data || data.length === 0) {
      await seedInitialData();
      return getUsers();
  } else {
      users = data.map(mapUserFromDB);
  }

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

export const deleteUser = async (userId: string): Promise<void> => {
    await supabase.from('notifications').delete().eq('user_id', userId);
    await supabase.from('notifications').delete().eq('from_user_id', userId);
    await supabase.from('comments').delete().eq('user_id', userId);
    await supabase.from('check_ins').delete().eq('user_id', userId);
    const { error } = await supabase.from('users').delete().eq('id', userId);

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
    // SANDBOX: Se for o usuário de teste, não salva nada
    if (user.name === TEST_USER_EMAIL) return;

    const { error } = await supabase.from('users').update({
        custom_avatar: user.customAvatar,
        password: user.password,
        weekly_plan: user.weeklyPlan // Save weekly plan
    }).eq('id', user.id);

    if (error) {
        const db = getLocalDB();
        const index = db.users.findIndex((u: any) => u.id === user.id);
        if (index !== -1) {
            db.users[index].custom_avatar = user.customAvatar;
            db.users[index].password = user.password;
            db.users[index].weekly_plan = user.weeklyPlan;
            saveLocalDB(db);
        }
    }
};

export const getUserByName = async (name: string): Promise<User | null> => {
  const { data, error } = await supabase
    .from('users')
    .select(`*, check_ins(*, comments(*))`)
    .ilike('name', name)
    .single();

  if (error || !data) {
      const db = getLocalDB();
      const localUser = db.users.find((u: any) => u.name.toLowerCase() === name.toLowerCase());
      if (!localUser) return null;
      const uCheckIns = db.check_ins.filter((c: any) => c.user_id === localUser.id).map((c: any) => ({
            ...c,
            comments: db.comments.filter((cm: any) => cm.check_in_id === c.id)
      }));
      const uNotifs = db.notifications.filter((n: any) => n.user_id === localUser.id);
      return mapUserFromDB({ ...localUser, check_ins: uCheckIns, notifications: uNotifs });
  }

  const { data: notifs } = await supabase.from('notifications').select('*').eq('user_id', data.id);
  const user = mapUserFromDB(data);
  user.notifications = notifs ? notifs.map(mapNotificationFromDB) : [];
  return user;
};

export const loginOrCreateUser = async (name: string): Promise<User> => {
  const existing = await getUserByName(name);
  if (existing) return existing;

  const newUser = {
    id: Date.now().toString(),
    name: name,
    avatar_seed: Math.floor(Math.random() * 1000),
    score: 0,
    streak: 0,
    weekly_plan: {}
  };

  const { data: created, error: createError } = await supabase
    .from('users')
    .insert(newUser)
    .select()
    .single();

  if (createError) {
      const db = getLocalDB();
      const localUser = { ...newUser, custom_avatar: null, password: null };
      db.users.push(localUser);
      saveLocalDB(db);
      return mapUserFromDB(localUser);
  }

  return mapUserFromDB(created!);
};

// BACKGROUND FUNCTION: Not exported to UI, runs silently
const processProvocations = async (userId: string, userName: string, oldScore: number, newScore: number) => {
    try {
        if (isHiddenUser(userName)) return;
        const { data: allUsers } = await supabase.from('users').select('id, name, score');
        if (!allUsers) return;
        
        const notificationsToInsert = [];
        for (const other of allUsers) {
            if (other.id !== userId && !isHiddenUser(other.name)) {
                if (other.score >= oldScore && other.score < newScore) {
                    notificationsToInsert.push({
                        id: Date.now().toString() + Math.random(),
                        type: 'OVERTAKE',
                        user_id: other.id,
                        from_user_id: userId,
                        message: `${userName} ultrapassou você hoje. Vai deixar?`,
                        timestamp: new Date().toISOString(),
                        read: false
                    });
                }
            }
        }
        if (notificationsToInsert.length > 0) {
            await supabase.from('notifications').insert(notificationsToInsert);
        }
    } catch (e) {
        console.warn("Error processing provocations:", e);
    }
};

export const performCheckIn = async (userId: string, photoBase64: string, caption: string = ''): Promise<User | null> => {
  cleanupExpiredTestCheckIns();

  const today = getTodayString();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  // Logic to save local
  const saveToLocalFallback = async (fallbackUserId: string, fallbackPhoto: string, fallbackCaption: string) => {
      console.log("TIMEOUT or ERROR: Saving checkin to local storage fallback");
      const db = getLocalDB();
      const user = db.users.find((u: any) => u.id === fallbackUserId);
      if (!user) return null;

      const userCheckIns = db.check_ins.filter((c: any) => c.user_id === fallbackUserId);
      if (userCheckIns.some((c: any) => c.date === today)) {
          return await loginOrCreateUser(user.name);
      }

      const hasYesterday = userCheckIns.some((c: any) => c.date === yesterdayStr);
      let newStreak = 1;
      if (hasYesterday) newStreak = user.streak + 1;
      
      // NOVA LÓGICA: 1 Ponto por Check-in
      const pointsEarned = 1;
      const newScore = user.score + pointsEarned;

      const newCheckIn = {
          id: Date.now().toString(),
          user_id: fallbackUserId,
          date: today,
          timestamp: new Date().toISOString(),
          photo: fallbackPhoto,
          videos: [],
          caption: fallbackCaption,
          likes: []
      };
      db.check_ins.push(newCheckIn);
      user.score = newScore;
      user.streak = newStreak;
      saveLocalDB(db);
      return await loginOrCreateUser(user.name);
  };

  // Helper calculation
  const calculateNewStats = (currentScore: number, currentStreak: number, hasCheckInYesterday: boolean) => {
      let newStreak = 1;
      if (hasCheckInYesterday) {
          newStreak = currentStreak + 1;
      }
      // NOVA LÓGICA: 1 Ponto por Check-in
      const pointsEarned = 1;
      const newScore = currentScore + pointsEarned;
      return { newScore, newStreak };
  };

  const { data: userDB, error: fetchError } = await supabase.from('users').select('*, check_ins(date)').eq('id', userId).single();
  
  if (fetchError || !userDB) {
      return await saveToLocalFallback(userId, photoBase64, caption);
  }

  // --- SANDBOX MODE FOR TEST USER ---
  // If user is test user, SIMULATE success but DO NOT SAVE to database.
  if (userDB.name === TEST_USER_EMAIL) {
      console.log("Sandbox Mode Active: Check-in simulated locally only.");
      const hasCheckInYesterday = userDB.check_ins.some((c: any) => c.date === yesterdayStr);
      const { newScore, newStreak } = calculateNewStats(userDB.score || 0, userDB.streak || 0, hasCheckInYesterday);

      // Create updated user object for UI
      const uiUser = mapUserFromDB(userDB);
      uiUser.score = newScore;
      uiUser.streak = newStreak;
      
      const fakeCheckIn: CheckIn = {
          id: `sandbox-${Date.now()}`,
          date: today,
          timestamp: new Date().toISOString(),
          photo: photoBase64,
          videos: [],
          likes: [],
          caption: caption,
          comments: []
      };
      
      // Prepend to array so it shows up
      uiUser.checkIns = [fakeCheckIn, ...uiUser.checkIns];
      
      return uiUser;
  }
  // --- END SANDBOX MODE ---

  // Check valid stats
  const hasCheckInToday = userDB.check_ins.some((c: any) => c.date === today);
  if (hasCheckInToday) return await loginOrCreateUser(userDB.name);
  
  const hasCheckInYesterday = userDB.check_ins.some((c: any) => c.date === yesterdayStr);
  const { newScore, newStreak } = calculateNewStats(userDB.score || 0, userDB.streak || 0, hasCheckInYesterday);

  // --- CRITICAL FIX: TIMEOUT RACE CONDITION & COMPATIBILITY ---
  
  const insertPromise = supabase.from('check_ins').insert({
      id: Date.now().toString(),
      user_id: userId,
      date: today,
      timestamp: new Date().toISOString(),
      photo: photoBase64, 
      caption: caption,
      likes: []
  });

  const timeoutPromise = new Promise((_, reject) => {
      // Increased timeout to 120s for safer mobile uploads
      setTimeout(() => reject(new Error('Supabase Timeout')), 120000); 
  });

  try {
      const result: any = await Promise.race([insertPromise, timeoutPromise]);
      
      if (result.error) throw result.error;

      // Update User Stats
      await supabase.from('users').update({
          score: newScore,
          streak: newStreak
      }).eq('id', userId);

      // Fire and forget provocation
      processProvocations(userId, userDB.name, userDB.score || 0, newScore);
      
      return await loginOrCreateUser(userDB.name);

  } catch (err) {
      // Catch Timeout or Supabase Error
      console.warn("Check-in failed due to timeout or error, switching to Local Mode.", err);
      return await saveToLocalFallback(userId, photoBase64, caption);
  }
};

export const addVideoToCheckIn = async (checkInId: string, videoBase64: string): Promise<boolean> => {
    // SANDBOX: If checking starts with sandbox (fake ID), return true immediately
    if (checkInId.startsWith('sandbox-')) return true;

    const { data, error } = await supabase.from('check_ins').select('videos').eq('id', checkInId).single();
    if (error) {
        const db = getLocalDB();
        const checkIn = db.check_ins.find((c: any) => c.id === checkInId);
        if (checkIn) {
            if (!checkIn.videos) checkIn.videos = [];
            checkIn.videos.push(videoBase64);
            saveLocalDB(db);
            return true;
        }
        return false;
    }
    const currentVideos = data.videos || [];
    const newVideos = [...currentVideos, videoBase64];
    const { error: updateError } = await supabase.from('check_ins').update({ videos: newVideos }).eq('id', checkInId);
    return !updateError;
}

export const addComment = async (checkInId: string, userId: string, text: string): Promise<void> => {
    // SANDBOX: If user is test user, return success without saving
    const { data: u } = await supabase.from('users').select('name').eq('id', userId).single();
    if (u && u.name === TEST_USER_EMAIL) return;

    const { error } = await supabase.from('comments').insert({
        id: Date.now().toString(),
        check_in_id: checkInId,
        user_id: userId,
        text: text,
        timestamp: new Date().toISOString()
    });
    if (error) {
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

export const deleteCheckIn = async (checkInId: string): Promise<void> => {
    await supabase.from('comments').delete().eq('check_in_id', checkInId);
    const { error } = await supabase.from('check_ins').delete().eq('id', checkInId);
    if (error) {
        const db = getLocalDB();
        db.check_ins = db.check_ins.filter((c: any) => c.id !== checkInId);
        db.comments = db.comments.filter((c: any) => c.check_in_id !== checkInId);
        saveLocalDB(db);
    }
};

export const clearNotifications = async (userId: string): Promise<User | null> => {
    const { error } = await supabase.from('notifications').delete().eq('user_id', userId);
    if (error) {
        const db = getLocalDB();
        db.notifications = db.notifications.filter((n: any) => n.user_id !== userId);
        saveLocalDB(db);
        return await loginOrCreateUser((db.users.find((u: any) => u.id === userId) as any).name);
    }
    return getUserByName((await supabase.from('users').select('name').eq('id', userId).single()).data.name);
}

export const getAllCheckIns = async (page: number = 0, limit: number = 10) => {
    cleanupExpiredTestCheckIns();

    const { data: allUsersRaw } = await supabase.from('users').select('id, name');
    
    const hiddenUserIds = allUsersRaw 
        ? allUsersRaw.filter((u: any) => isHiddenUser(u.name)).map((u: any) => u.id)
        : [];

    const from = page * limit;
    const to = from + limit - 1;

    const { data: checkIns, error } = await supabase
        .from('check_ins')
        .select(`*, comments (*), users (id, name, avatar_seed, custom_avatar)`)
        .order('timestamp', { ascending: false })
        .range(from, to);
    
    let result = [];

    if (error) {
        const db = getLocalDB();
        const localHiddenIds = db.users.filter((u: any) => isHiddenUser(u.name)).map((u: any) => u.id);
        const combined = db.check_ins.map((c: any) => {
            const u = db.users.find((user: any) => user.id === c.user_id);
            const comments = db.comments.filter((cm: any) => cm.check_in_id === c.id);
            return { ...c, comments: comments, users: u };
        }).sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        const paginatedCombined = combined.slice(from, from + limit);

        result = paginatedCombined.map((row: any) => ({
            user: {
                id: row.users.id,
                name: row.users.name,
                avatarSeed: row.users.avatar_seed,
                customAvatar: row.users.custom_avatar,
                checkIns: [], streak: 0, score: 0
            } as User,
            checkIn: mapCheckInFromDB(row)
        }));
        
        result = result.filter((item: any) => !isHiddenUser(item.user.name));
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
            checkIns: [], streak: 0, score: 0
        } as User,
        checkIn: mapCheckInFromDB(row)
    }));

    result = result.filter((item: any) => !isHiddenUser(item.user.name));
    result.forEach((item: any) => {
        if (item.checkIn.likes && item.checkIn.likes.length > 0) {
            item.checkIn.likes = item.checkIn.likes.filter((userId: string) => !hiddenUserIds.includes(userId));
        }
        if (item.checkIn.comments && item.checkIn.comments.length > 0) {
            item.checkIn.comments = item.checkIn.comments.filter((comment: Comment) => !hiddenUserIds.includes(comment.userId));
        }
    });

    return result;
};

export const toggleCheckInLike = async (checkInId: string, currentUserId: string): Promise<void> => {
    // SANDBOX
    const { data: u } = await supabase.from('users').select('name').eq('id', currentUserId).single();
    if (u && u.name === TEST_USER_EMAIL) return;

    const { data, error } = await supabase.from('check_ins').select('likes').eq('id', checkInId).single();
    if (error) {
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