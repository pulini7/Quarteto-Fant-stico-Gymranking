import { User, CheckIn, Comment, Notification } from '../types';
import { supabase } from './supabaseClient';

// Helper to get today's date string YYYY-MM-DD in LOCAL TIME
export const getTodayString = (): string => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Helper to check if a date string is Saturday (6) or Sunday (0)
export const isWeekend = (dateString: string): boolean => {
  const d = new Date(`${dateString}T12:00:00`);
  const day = d.getDay();
  return day === 0 || day === 6;
};

// --- STATS CALCULATION ENGINE (SINGLE SOURCE OF TRUTH) ---
// Calcula Score e Streak baseado puramente no histórico de check-ins
const calculateStatsFromCheckIns = (checkIns: CheckIn[]) => {
    // 1. Get Unique Dates sorted Descending
    const uniqueDates = Array.from(new Set(checkIns.map(c => c.date))).sort().reverse();
    
    let score = 0;
    
    // 2. Calculate Score (Rules: 1pt Weekday, 2pt Weekend)
    checkIns.forEach(c => {
        const d = new Date(`${c.date}T12:00:00`);
        const day = d.getDay(); // 0=Sun, 6=Sat
        const isWknd = day === 0 || day === 6;
        score += isWknd ? 2 : 1;
    });

    // 3. Calculate Streak
    let streak = 0;
    const today = getTodayString();
    
    const getPreviousDate = (dateStr: string) => {
        const d = new Date(`${dateStr}T12:00:00`);
        d.setDate(d.getDate() - 1);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };

    const hasToday = uniqueDates.includes(today);
    const yesterday = getPreviousDate(today);
    const hasYesterday = uniqueDates.includes(yesterday);

    if (hasToday || hasYesterday) {
        streak = 1;
        let currentCheck = hasToday ? today : yesterday;
        while (true) {
            const prev = getPreviousDate(currentCheck);
            if (uniqueDates.includes(prev)) {
                streak++;
                currentCheck = prev;
            } else {
                break;
            }
        }
    }

    return { score, streak };
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
    try {
        const stored = localStorage.getItem(LOCAL_DB_KEY);
        if (stored) return JSON.parse(stored);
    } catch (e) {
        console.error("Erro ao ler LocalStorage:", e);
    }
    
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
    
    // Tenta salvar o inicial, se falhar, retorna o objeto em memória mesmo
    try {
        localStorage.setItem(LOCAL_DB_KEY, JSON.stringify(initial));
    } catch (e) { /* ignore */ }
    
    return initial;
};

const saveLocalDB = (db: any) => {
    try {
        localStorage.setItem(LOCAL_DB_KEY, JSON.stringify(db));
    } catch (e) {
        console.error("Falha ao salvar no LocalStorage (Quota Exceeded possivelmente):", e);
        try {
            if (db.check_ins) {
                db.check_ins.forEach((c: any) => { delete c.videos; });
            }
            if (db.notifications) {
                db.notifications = db.notifications.filter((n: any) => !n.read);
            }
            localStorage.setItem(LOCAL_DB_KEY, JSON.stringify(db));
        } catch (retryError) {
            console.error("Falha crítica no LocalStorage. Dados não persistidos localmente.", retryError);
        }
    }
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

// --- HELPER: Merge Remote and Local Data ---
const mergeUserWithLocalData = (remoteUser: User, db: any): User => {
    const localUser = db.users.find((u: any) => u.id === remoteUser.id);
    const mergedUser = { ...remoteUser };

    // 1. Merge CheckIns (Priority: Remote, but add Local-only)
    const localCheckIns = db.check_ins
        .filter((c: any) => c.user_id === remoteUser.id)
        .map((c: any) => {
             const comments = db.comments.filter((cm: any) => cm.check_in_id === c.id);
             return { ...c, comments };
        })
        .map(mapCheckInFromDB);

    const existingIds = new Set(remoteUser.checkIns.map(c => c.id));
    const missingLocalCheckIns = localCheckIns.filter((c: CheckIn) => !existingIds.has(c.id));
    
    if (missingLocalCheckIns.length > 0) {
        mergedUser.checkIns = [...remoteUser.checkIns, ...missingLocalCheckIns];
        // Re-sort descending
        mergedUser.checkIns.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }

    // 2. Recalculate Stats after Merge to ensure accuracy
    // Instead of trusting local score, we recalc from the merged check-ins
    const { score, streak } = calculateStatsFromCheckIns(mergedUser.checkIns);
    mergedUser.score = score;
    mergedUser.streak = streak;
    
    return mergedUser;
};

// --- Core Functions ---

export const resetGlobalRanking = async (): Promise<void> => {
    // This physically resets the numbers, but if check-ins remain, they will be recalculated on next load.
    // Ideally this should only be used if wiping check-ins too.
    await supabase.from('users').update({ score: 0, streak: 0 }).neq('id', '0'); 
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
    // Uses full getUsers logic now to ensure stats are correct for login screen badges if we add them back later,
    // or just to have consistent data structure. Since optimization was requested earlier, we keep it light but correct.
    return getUsers(); 
}

export const getLeaderboardData = async (): Promise<User[]> => {
    return getUsers(); // Use full logic to ensure correct counts
}

export const getUsers = async (): Promise<User[]> => {
  let query = supabase
    .from('users')
    .select(`
      id, name, avatar_seed, custom_avatar, score, streak, weekly_plan,
      check_ins (
        *,
        comments (*)
      )
    `)
    .order('score', { ascending: false });

  let { data, error } = await query;

  if (error) {
      console.warn("Retrying getUsers without weekly_plan...");
      const retry = await supabase
        .from('users')
        .select(`
          id, name, avatar_seed, custom_avatar, score, streak,
          check_ins (
            *,
            comments (*)
          )
        `)
        .order('score', { ascending: false });
      data = retry.data;
      error = retry.error;
  }

  const db = getLocalDB();

  if (error) {
    console.warn('Supabase error (switching to local):', error.message);
    const usersWithRelations = db.users.map((u: any) => {
        const uCheckIns = db.check_ins.filter((c: any) => c.user_id === u.id).map((c: any) => ({
            ...c,
            comments: db.comments.filter((cm: any) => cm.check_in_id === c.id)
        }));
        return { ...u, check_ins: uCheckIns };
    });
    return usersWithRelations.map(mapUserFromDB).sort((a: User, b: User) => b.score - a.score).filter(u => !isHiddenUser(u.name));
  } 
  
  if (!data || data.length === 0) {
      await seedInitialData();
      return getUsers();
  } 
  
  // MERGE STRATEGY & SELF-HEALING
  const remoteUsers = data.map(mapUserFromDB);
  const finalUsers = remoteUsers.map(u => {
      // 1. Merge Local Checkins
      const merged = mergeUserWithLocalData(u, db);
      
      // 2. SELF-HEALING: Recalculate stats to guarantee consistency between check_ins count and score/streak
      const { score, streak } = calculateStatsFromCheckIns(merged.checkIns);
      
      // If DB is out of sync, update it silently in background
      if (score !== u.score || streak !== u.streak) {
          // console.log(`Self-healing user ${u.name}: Score ${u.score}->${score}, Streak ${u.streak}->${streak}`);
          supabase.from('users').update({ score, streak }).eq('id', u.id).then();
          merged.score = score;
          merged.streak = streak;
      }
      
      return merged;
  });

  return finalUsers.sort((a, b) => b.score - a.score).filter(u => !isHiddenUser(u.name));
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

    // Tenta salvar com weekly_plan
    const { error } = await supabase.from('users').update({
        custom_avatar: user.customAvatar,
        password: user.password,
        weekly_plan: user.weeklyPlan
    }).eq('id', user.id);

    // Se der erro (provavelmente coluna faltando), tenta salvar sem
    if (error) {
        await supabase.from('users').update({
            custom_avatar: user.customAvatar,
            password: user.password
        }).eq('id', user.id);
        
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

  const db = getLocalDB();

  if (error || !data) {
      const localUser = db.users.find((u: any) => u.name.toLowerCase() === name.toLowerCase());
      if (!localUser) return null;
      const uCheckIns = db.check_ins.filter((c: any) => c.user_id === localUser.id).map((c: any) => ({
            ...c,
            comments: db.comments.filter((cm: any) => cm.check_in_id === c.id)
      }));
      const uNotifs = db.notifications.filter((n: any) => n.user_id === localUser.id);
      
      let user = mapUserFromDB({ ...localUser, check_ins: uCheckIns, notifications: uNotifs });
      // Recalc locally
      const { score, streak } = calculateStatsFromCheckIns(user.checkIns);
      user.score = score;
      user.streak = streak;
      return user;
  }

  const { data: notifs } = await supabase.from('notifications').select('*').eq('user_id', data.id);
  let user = mapUserFromDB(data);
  user.notifications = notifs ? notifs.map(mapNotificationFromDB) : [];
  
  // SAFETY CHECK GAP FILLER
  const today = getTodayString();
  const hasToday = user.checkIns.some(c => c.date === today);
  
  if (!hasToday) {
      const { data: directCheckIn } = await supabase
        .from('check_ins')
        .select('*, comments(*)')
        .eq('user_id', user.id)
        .eq('date', today)
        .single();
      
      if (directCheckIn) {
          const checkIn = mapCheckInFromDB(directCheckIn);
          user.checkIns = [checkIn, ...user.checkIns];
      }
  }

  // Merge Local
  user = mergeUserWithLocalData(user, db);

  // SELF-HEALING ON LOGIN
  const { score, streak } = calculateStatsFromCheckIns(user.checkIns);
  if (score !== user.score || streak !== user.streak) {
      await supabase.from('users').update({ score, streak }).eq('id', user.id);
      user.score = score;
      user.streak = streak;
  }

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

export const performCheckIn = async (userId: string, photoBase64: string, caption: string = '', videoBase64?: string): Promise<User | null> => {
  cleanupExpiredTestCheckIns();

  const today = getTodayString();
  
  // Logic to save local
  const saveToLocalFallback = async (fallbackUserId: string, fallbackPhoto: string, fallbackCaption: string, fallbackVideo?: string) => {
      console.log("TIMEOUT or ERROR: Saving checkin to local storage fallback");
      const db = getLocalDB();
      const user = db.users.find((u: any) => u.id === fallbackUserId);
      if (!user) return null;

      const userCheckIns = db.check_ins.filter((c: any) => c.user_id === fallbackUserId);
      // Construct CheckIn object to calculate stats
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

      if (!userCheckIns.some((c: any) => c.date === today)) {
         db.check_ins.push(newCheckIn);
      }
      
      const allCheckIns = [...userCheckIns.map(mapCheckInFromDB), mapCheckInFromDB(newCheckIn)];
      const { score, streak } = calculateStatsFromCheckIns(allCheckIns);
      
      user.score = score;
      user.streak = streak;
      saveLocalDB(db);
      return await loginOrCreateUser(user.name);
  };

  try {
      const { data: userDB, error: fetchError } = await supabase
        .from('users')
        .select('*, check_ins(*, comments(*))')
        .eq('id', userId)
        .single();
      
      if (fetchError || !userDB) {
          return await saveToLocalFallback(userId, photoBase64, caption, videoBase64);
      }

      // --- SANDBOX MODE FOR TEST USER ---
      if (userDB.name === TEST_USER_EMAIL) {
          const fakeCheckIn: CheckIn = {
              id: `sandbox-${Date.now()}`,
              date: today,
              timestamp: new Date().toISOString(),
              photo: photoBase64,
              videos: videoBase64 ? [videoBase64] : [],
              likes: [],
              caption: caption,
              comments: []
          };
          
          const uiUser = mapUserFromDB(userDB);
          const { score, streak } = calculateStatsFromCheckIns([fakeCheckIn, ...uiUser.checkIns]);
          uiUser.score = score;
          uiUser.streak = streak;
          uiUser.checkIns = [fakeCheckIn, ...uiUser.checkIns];
          return uiUser;
      }

      const hasCheckInToday = userDB.check_ins.some((c: any) => c.date === today);
      if (hasCheckInToday) {
          return await loginOrCreateUser(userDB.name);
      }
      
      const insertPayload = {
          id: Date.now().toString(),
          user_id: userId,
          date: today,
          timestamp: new Date().toISOString(),
          photo: photoBase64, 
          caption: caption,
          likes: [],
          videos: videoBase64 ? [videoBase64] : []
      };

      // 1. Insert CheckIn
      await supabase.from('check_ins').insert(insertPayload);

      // 2. Recalculate Stats based on new list
      const currentCheckIns = userDB.check_ins.map(mapCheckInFromDB);
      const newCheckInObj = mapCheckInFromDB(insertPayload);
      const allCheckIns = [newCheckInObj, ...currentCheckIns];
      
      const { score: newScore, streak: newStreak } = calculateStatsFromCheckIns(allCheckIns);

      // 3. Update User Stats
      await supabase.from('users').update({
          score: newScore,
          streak: newStreak
      }).eq('id', userId);

      // Fire and forget provocation check
      processProvocations(userId, userDB.name, userDB.score || 0, newScore);
      
      // OPTIMISTIC UPDATE
      const baseUser = mapUserFromDB(userDB);
      const updatedUser: User = {
          ...baseUser,
          score: newScore,
          streak: newStreak,
          checkIns: allCheckIns
      };

      return updatedUser;

  } catch (err) {
      console.warn("Check-in failed due to timeout or error, switching to Local Mode.", err);
      return await saveToLocalFallback(userId, photoBase64, caption, videoBase64);
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
            // LOCAL STORAGE PROTECTION: Não salva vídeos grandes
            if (videoBase64.length < 500000) {
                 checkIn.videos.push(videoBase64);
                 saveLocalDB(db);
                 return true;
            } else {
                console.warn("Vídeo ignorado no armazenamento local por tamanho.");
                return false;
            }
        }
        return false;
    }
    const currentVideos = data.videos || [];
    const newVideos = [...currentVideos, videoBase64];
    const { error: updateError } = await supabase.from('check_ins').update({ videos: newVideos }).eq('id', checkInId);
    return !updateError;
}

export const addComment = async (checkInId: string, userId: string, text: string): Promise<void> => {
    // SANDBOX
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
    // Need to fetch the checkin first to know the user_id to recalculate stats
    let userId = '';
    
    // Try fetch from DB
    const { data: checkIn } = await supabase.from('check_ins').select('user_id').eq('id', checkInId).single();
    if (checkIn) userId = checkIn.user_id;
    
    await supabase.from('comments').delete().eq('check_in_id', checkInId);
    const { error } = await supabase.from('check_ins').delete().eq('id', checkInId);
    
    const db = getLocalDB();
    
    // Fallback or Local handling
    if (error || !checkIn) {
        const localCheckIn = db.check_ins.find((c: any) => c.id === checkInId);
        if (localCheckIn) {
            userId = localCheckIn.user_id;
            db.check_ins = db.check_ins.filter((c: any) => c.id !== checkInId);
            db.comments = db.comments.filter((c: any) => c.check_in_id !== checkInId);
            saveLocalDB(db);
        }
    }

    // RECALCULATE USER STATS
    if (userId) {
        const { data: userDB } = await supabase.from('users').select('*, check_ins(*)').eq('id', userId).single();
        if (userDB) {
            const allCheckIns = userDB.check_ins.map(mapCheckInFromDB);
            const { score, streak } = calculateStatsFromCheckIns(allCheckIns);
            await supabase.from('users').update({ score, streak }).eq('id', userId);
        } else {
             // Local Update
             const user = db.users.find((u: any) => u.id === userId);
             if (user) {
                 const uCheckIns = db.check_ins.filter((c: any) => c.user_id === userId).map(mapCheckInFromDB);
                 const { score, streak } = calculateStatsFromCheckIns(uCheckIns);
                 user.score = score;
                 user.streak = streak;
                 saveLocalDB(db);
             }
        }
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

    // 1. Fetch from Supabase
    const { data: supabaseCheckIns, error } = await supabase
        .from('check_ins')
        .select(`*, comments (*), users (id, name, avatar_seed, custom_avatar)`)
        .order('timestamp', { ascending: false })
        .range(from, to);
    
    // 2. Fetch from Local Storage (Fallback)
    // Always fetch local data to ensure "offline" or "timeout" check-ins are visible
    const db = getLocalDB();
    const localHiddenIds = db.users.filter((u: any) => isHiddenUser(u.name)).map((u: any) => u.id);
    
    const localCheckIns = db.check_ins.map((c: any) => {
        const u = db.users.find((user: any) => user.id === c.user_id);
        const comments = db.comments.filter((cm: any) => cm.check_in_id === c.id);
        return { ...c, comments: comments, users: u };
    });

    // 3. Merge Strategies
    let mergedCheckIns = [];

    if (error || !supabaseCheckIns) {
        // If Supabase failed completely, use local only
        mergedCheckIns = localCheckIns;
    } else {
        // If Supabase succeeded, we still want to show pending local check-ins that aren't in Supabase yet
        // Filter out local check-ins that are already in Supabase (by ID)
        const supabaseIds = new Set(supabaseCheckIns.map((c: any) => c.id));
        const pendingLocal = localCheckIns.filter((c: any) => !supabaseIds.has(c.id));
        
        mergedCheckIns = [...supabaseCheckIns, ...pendingLocal];
    }

    // 4. Sort and Pagination logic after merge (simplified for feed mix)
    // Note: Since we are mixing paginated remote data with all local data, 
    // sorting might put local data on top.
    mergedCheckIns.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    // Slice to respect page limit if we are strictly offline, but if mixing, we might show a bit more
    // For now, let's just map and filter hidden users
    let result = mergedCheckIns.map((row: any) => ({
        user: {
            id: row.users?.id || 'unknown',
            name: row.users?.name || 'Unknown',
            avatarSeed: row.users?.avatar_seed || 0,
            customAvatar: row.users?.custom_avatar,
            checkIns: [], streak: 0, score: 0
        } as User,
        checkIn: mapCheckInFromDB(row)
    }));
    
    // Filter hidden users
    const allHiddenIds = [...hiddenUserIds, ...localHiddenIds];
    result = result.filter((item: any) => !isHiddenUser(item.user.name));
    
    result.forEach((item: any) => {
        if (item.checkIn.likes && item.checkIn.likes.length > 0) {
            item.checkIn.likes = item.checkIn.likes.filter((userId: string) => !allHiddenIds.includes(userId));
        }
        if (item.checkIn.comments && item.checkIn.comments.length > 0) {
            item.checkIn.comments = item.checkIn.comments.filter((comment: Comment) => !allHiddenIds.includes(comment.userId));
        }
    });

    return result;
};

export const toggleCheckInLike = async (checkInId: string, currentUserId: string): Promise<void> => {
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