export interface RecentAccount {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  role: string;
  standard?: string;
  houseTeam?: string;
}

export interface LeadershipLegacyEntry {
  id: string;
  year: string;
  userId: string;
  userName: string;
  role: string;
  houseTitle: string;
  houseTeam: string;
  photoURL?: string;
  timestamp: any;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  role: 'Admin' | 'Leader' | 'Student' | 'Alumni';
  gender?: 'Sir' | 'Madam';
  rollNumber?: string;
  standard?: string;
  houseTeam?: 'GOOD PIONEER' | 'GOOD PATRON' | 'GOOD SAVIOUR' | 'GOOD SHEPHERD';
  leaderPosition?: 'SECRETARY/ P.M' | 'SECRETARY / C.M' | 'EDUCATIONAL MINISTER' | 'FINANCE MINISTER' | 'DEFENCE MINISTER' | 'SPEAKER';
  bio?: string;
  photoURL?: string;
  isOnline?: boolean;
  isVerified?: boolean;
  isDeleted?: boolean;
  houseTitle?: 'Captain' | 'Vice-Captain' | 'None';
  leadershipStatus?: 'pending_verification' | 'verified' | 'rejected';
  isLeadershipPublic?: boolean;
  totalPoints?: number;
  cards?: {
    white?: number;
    yellow?: number;
    blue?: number;
    green?: number;
    pink?: number;
  };
  redCards?: number;
  lastActive?: any;
  createdAt: any;
  updatedAt: any;
  batchYear?: string;
  lastNotificationReadAt?: any;
  fcmTokens?: string[];
  legacyBadges?: {
    year: string;
    totalPoints: number;
    cards: {
      white?: number;
      yellow?: number;
      blue?: number;
      green?: number;
      pink?: number;
    };
  }[];
  studentData?: {
    points: number;
    cards: {
      white?: number;
      yellow?: number;
      blue?: number;
      green?: number;
      pink?: number;
    };
    quizResults?: any[];
  };
  leaderData?: {
    pointsDistributed: number;
    telecastPermissions: boolean;
    houseRank: number;
    leadershipImpactScore?: number;
    distinctStudentsHelped?: number;
    activityStreak?: number;
    lastCommandCenterCheck?: any;
    telecastEngagementPoints?: number;
  };
}

export interface RewardHistory {
  id: string;
  recipientId: string;
  recipientName: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  type: 'card' | 'points' | 'deduction';
  value: string; // Color name or points amount
  points?: number;
  reason: string;
  timestamp: any;
}

export interface PointEntry {
  id: string;
  studentName: string;
  studentId: string;
  points: number;
  reason: string;
  category: 'Academic' | 'Sports' | 'Behavior' | 'Other';
  timestamp: any;
  house: string;
  isAlert?: boolean;
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  studentName: string;
  standard: string;
  house: string;
  status: 'Present' | 'Absent' | 'Late' | 'Excused';
  date: string; // YYYY-MM-DD
  markedBy?: string;
  markedByName?: string;
  updatedAt: any;
}

export interface TestResult {
  id: string;
  studentId: string;
  studentName: string;
  standard: string;
  testName: string;
  subject: string;
  score: number;
  totalScore: number;
  percentage: number;
  grade: string;
  date: string;
  createdAt: any;
}

export interface LiveClass {
  id: string;
  title: string;
  standard: string;
  subject: string;
  teacherName: string;
  status: 'Scheduled' | 'Live' | 'Ended';
  activeRoomId?: string;
  viewerCount?: number;
  videoUrl?: string;
  captionsUrl?: string;
  createdAt: any;
}

export interface RoomParticipant {
  uid: string;
  displayName: string;
  role: string;
  houseTeam?: string;
  joinedAt: any;
  isMuted?: boolean;
  isVideoOff?: boolean;
  isHandRaised?: boolean;
  isSpeaking?: boolean;
  forceMute?: boolean;
}

export interface QuizQuestion {
  id: string;
  text: string;
  options: string[];
  correctAnswer: number;
  marks: number;
}

export interface Quiz {
  id: string;
  title: string;
  subject: string;
  standard: string;
  status: 'Active' | 'Completed';
  participants: number;
  questions: QuizQuestion[];
  durationMinutes: number;
  endTime?: any; // For auto-submit timer
  authorName: string;
  authorId: string;
  createdAt: any;
}

export interface AttendanceStats {
  present: number;
  total: number;
}

export interface HouseStats {
  id: string;
  totalPoints: number;
  cardCounts: {
    white?: number;
    yellow?: number;
    blue?: number;
    green?: number;
    pink?: number;
  };
  lastUpdated: any;
}

export interface Course {
  id: string;
  title: string;
  description: string;
  subject: string;
  standard: string;
  teacherId: string;
  teacherName: string;
  prerequisites?: string[];
  learningObjectives?: string[];
  createdAt: any;
}

export interface Assignment {
  id: string;
  courseId: string;
  title: string;
  description: string;
  dueDate: string;
  points: number;
  priority: 'High' | 'Medium' | 'Low';
  createdAt: any;
}

export interface Progress {
  id: string;
  studentId: string;
  courseId: string;
  completedAssignments: string[]; // Array of assignment IDs
  completionPercentage: number;
  grade?: string;
  lastAccessed: any;
}

export interface QuizResult {
  id: string;
  studentId: string;
  studentName: string;
  standard?: string;
  quizId: string;
  quizTitle: string;
  subject: string;
  score: number;
  totalScore: number;
  answers: number[];
  status: 'in-progress' | 'submitted' | 'auto-submitted';
  proctoringStatus?: 'Online' | 'Warning' | 'Auto-Submitted';
  cheatAttempts?: number;
  timestamp: any;
}

export interface DailyQuiz {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number; // Index of correct option
  standard: string;
  subject: string;
  authorId: string;
  authorName: string;
  createdAt: any;
}

export interface DailyQuizResult {
  id: string;
  quizId: string;
  studentId: string;
  studentName: string;
  selectedAnswer: number;
  isCorrect: boolean;
  timestamp: any;
}

export interface AcademicContent {
  id: string;
  title: string;
  description: string;
  type: 'Video' | 'Notes' | 'Quiz';
  url?: string;
  standard: string;
  subject: string;
  authorId: string;
  authorName: string;
  status?: 'uploading' | 'ready' | 'error';
  uploadProgress?: number;
  createdAt: any;
}

export interface ReportCard {
  id: string;
  studentId: string;
  studentName: string;
  standard: string;
  house: string;
  overallGrade: string;
  subjects: {
    [key: string]: {
      marks: number;
      grade: string;
    };
  };
  skills: {
    listening: string;
    reading: string;
    speaking: string;
    writing: string;
  };
  attendance: {
    present: number;
    absent: number;
    participation: string;
  };
  quizMarks: string;
  housePerformance: number;
  summary: string;
  remarks: string;
  recommendations: string[];
  createdAt: any;
  updatedAt: any;
}

export interface Announcement {
  id: string;
  title: string;
  type: 'General' | 'Academic' | 'Event' | 'Urgent';
  targetAudience: string; // 'All Standards' or 'Standard X'
  message: string;
  expiryDate?: string;
  status: 'Published' | 'Draft';
  authorName: string;
  authorId: string;
  createdAt: any;
  category?: string; // For backward compatibility if needed or future use
  priority?: 'High' | 'Medium' | 'Low'; // For student dashboard view
}

export interface InstitutionEvent {
  id: string;
  title: string;
  description: string;
  category: string;
  videoUrl: string;
  thumbnailUrl?: string;
  authorId: string;
  authorName: string;
  standard?: string;
  status?: 'uploading' | 'ready' | 'error';
  uploadProgress?: number;
  createdAt: any;
}

export interface LiveTelecast {
  id: string;
  title: string;
  status: 'Live' | 'Ended';
  url: string;
  startedAt: any;
  startedBy: string;
  standard?: string;
  viewerCount?: number;
}

export interface LiveReaction {
  id: string;
  type: 'heart' | 'clap' | 'like' | 'wow';
  userId: string;
  userName: string;
  timestamp: any;
}

export interface LiveChatMessage {
  id: string;
  userId: string;
  userName: string;
  text: string;
  timestamp: any;
}

export interface Notification {
  id: string;
  userId?: string; // Target user (optional for global/targeted)
  target?: string; // 'all', 'Standard 10', 'GOOD PIONEER', etc.
  title: string;
  message: string;
  type: 'Course' | 'Event' | 'Live' | 'Discussion' | 'General' | 'Class' | 'Reward' | 'System' | 'Upload';
  link?: string;
  read?: boolean;
  createdAt: any;
}

export interface PortfolioEntry {
  id: string;
  userId: string;
  title: string;
  type: 'Progress Report' | 'Quiz Award' | 'Leadership Milestone' | 'Achievement';
  date: string;
  downloadUrl?: string;
  totalPointsAtTime: number;
  badgesEarned?: string[];
  leadershipStats?: {
    pointsDistributed: number;
    houseRankAtTime: number;
  };
  timestamp: any;
}

export interface DiscussionMessage {
  id?: string;
  standard: string;
  userId: string;
  userName: string;
  userPhoto?: string;
  text: string;
  createdAt: any;
}

export interface LivePoll {
  id: string;
  question: string;
  options: string[];
  votes: Record<string, number>; // userId -> optionIndex
  status: 'Active' | 'Closed';
  createdAt: any;
}

export interface WhiteboardAction {
  type: 'draw' | 'clear';
  x0?: number;
  y0?: number;
  x1?: number;
  y1?: number;
  color?: string;
  width?: number;
}

export interface ArchiveBatch {
  id: string; // e.g., "Batch_2025"
  yearLabel: string;
  archivedAt: any;
  archivedBy: string;
  archivedByName: string;
  summary: {
    totalPoints: number;
    winningHouse: string;
    totalCards: number;
  };
}

export interface HallOfFameEntry {
  id: string;
  period: string;
  winnerHouse: string;
  studentOfMonth?: string;
  studentId?: string;
  totalPoints: number;
  houseColor: string;
  type: 'Monthly' | 'Yearly';
  timestamp: any;
}

export interface ArchivedHouseStats extends HouseStats {
  batchId: string;
}
