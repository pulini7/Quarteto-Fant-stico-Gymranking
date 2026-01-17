import { User, CheckIn } from '../types';

const STORAGE_KEY = 'gymrank_quarteto_v1'; // New key for the new group

// Helper to get today's date string YYYY-MM-DD
export const getTodayString = (): string => {
  return new Date().toISOString().split('T')[0];
};

// Helper to check if a date string is Saturday (6) or Sunday (0)
export const isWeekend = (dateString: string): boolean => {
  // Append T12:00:00 to avoid timezone issues turning a date into previous day
  const d = new Date(`${dateString}T12:00:00`);
  const day = d.getDay();
  return day === 0 || day === 6;
};

export const calculateScore = (checkIns: CheckIn[]): number => {
  return checkIns.reduce((acc, curr) => {
    const points = isWeekend(curr.date) ? 20 : 10;
    return acc + points;
  }, 0);
};

const seedData: User[] = [
  { 
    id: '1', 
    name: 'Aline', 
    avatarSeed: 501, 
    checkIns: [], 
    streak: 0,
    score: 0
  },
  { 
    id: '2', 
    name: 'Samila', 
    avatarSeed: 502, 
    checkIns: [], 
    streak: 0,
    score: 0
  },
  { 
    id: '3', 
    name: 'Pâmela', 
    avatarSeed: 503, 
    checkIns: [], 
    streak: 0,
    score: 0
  },
  { 
    id: '4', 
    name: 'Taís', 
    avatarSeed: 504, 
    checkIns: [], 
    streak: 0,
    score: 0
  }
];

export const getUsers = (): User[] => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seedData));
    return seedData;
  }
  
  let users: User[] = JSON.parse(stored);
  
  // Migration/Integrity Check: Ensure score matches check-in history
  // This ensures existing users get points for past weekends immediately
  let updated = false;
  users = users.map(u => {
    const calculatedScore = calculateScore(u.checkIns);
    if (u.score !== calculatedScore) {
      updated = true;
      return { ...u, score: calculatedScore };
    }
    return u;
  });

  if (updated) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
  }

  return users;
};

export const saveUser = (user: User): void => {
  const users = getUsers();
  const existingIndex = users.findIndex(u => u.id === user.id);
  
  if (existingIndex >= 0) {
    users[existingIndex] = user;
  } else {
    users.push(user);
  }
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
};

export const loginOrCreateUser = (name: string): User => {
  const users = getUsers();
  // Case insensitive matching
  const existing = users.find(u => u.name.toLowerCase() === name.toLowerCase());
  
  if (existing) {
    return existing;
  }
  
  // If for some reason a new name comes in (future proofing), create it
  const newUser: User = {
    id: Date.now().toString(),
    name,
    avatarSeed: Math.floor(Math.random() * 1000),
    checkIns: [],
    streak: 0,
    score: 0
  };
  
  saveUser(newUser);
  return newUser;
};

export const performCheckIn = (userId: string, photoBase64: string, caption: string = ''): User | null => {
  const users = getUsers();
  const userIndex = users.findIndex(u => u.id === userId);
  
  if (userIndex === -1) return null;
  
  const user = users[userIndex];
  const today = getTodayString();
  
  // Check if already checked in today
  if (user.checkIns.some(c => c.date === today)) {
    return user; 
  }
  
  // Calculate Streak
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  
  let newStreak = 1;
  if (user.checkIns.some(c => c.date === yesterdayStr)) {
    newStreak = user.streak + 1;
  }
  
  const newCheckIn: CheckIn = {
    id: Date.now().toString(),
    date: today,
    timestamp: new Date().toISOString(),
    photo: photoBase64,
    likes: [],
    caption: caption
  };
  
  // Calculate Points (Weekend Bonus)
  const pointsEarned = isWeekend(today) ? 20 : 10;
  const newScore = (user.score || 0) + pointsEarned;

  const updatedUser = {
    ...user,
    checkIns: [...user.checkIns, newCheckIn],
    streak: newStreak,
    score: newScore
  };
  
  users[userIndex] = updatedUser;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
  
  return updatedUser;
};

export const getAllCheckIns = () => {
    const users = getUsers();
    const allCheckIns: { user: User, checkIn: CheckIn }[] = [];
    
    users.forEach(user => {
        user.checkIns.forEach(checkIn => {
            // Only include check-ins that actually have photos or are valid
            if (checkIn.photo || checkIn.date) {
                allCheckIns.push({ user, checkIn });
            }
        });
    });

    // Sort by timestamp desc (newest first)
    return allCheckIns.sort((a, b) => 
        new Date(b.checkIn.timestamp).getTime() - new Date(a.checkIn.timestamp).getTime()
    );
};

export const toggleCheckInLike = (checkInId: string, currentUserId: string): void => {
    const users = getUsers();
    let updated = false;

    // Find the user who owns the check-in and the check-in itself
    for (let i = 0; i < users.length; i++) {
        const user = users[i];
        const checkInIndex = user.checkIns.findIndex(c => c.id === checkInId);
        
        if (checkInIndex !== -1) {
            const checkIn = user.checkIns[checkInIndex];
            const likes = checkIn.likes || []; // Safety check for old data
            
            if (likes.includes(currentUserId)) {
                // Remove like
                checkIn.likes = likes.filter(id => id !== currentUserId);
            } else {
                // Add like
                checkIn.likes = [...likes, currentUserId];
            }
            
            user.checkIns[checkInIndex] = checkIn;
            users[i] = user;
            updated = true;
            break; // Found and updated
        }
    }

    if (updated) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
    }
};