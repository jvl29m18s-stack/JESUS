import { collection, addDoc, serverTimestamp, query, where, orderBy, onSnapshot, doc, updateDoc, writeBatch, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { Notification, UserProfile } from '../types';

export const sendNotification = async (notification: Omit<Notification, 'id' | 'createdAt' | 'read'>) => {
  try {
    await addDoc(collection(db, 'notifications'), {
      ...notification,
      read: false,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error sending notification:', error);
  }
};

export const sendBulkNotification = async (userIds: string[], notification: Omit<Notification, 'id' | 'createdAt' | 'read' | 'userId'>) => {
  try {
    const batch = writeBatch(db);
    userIds.forEach(userId => {
      const docRef = doc(collection(db, 'notifications'));
      batch.set(docRef, {
        ...notification,
        userId,
        read: false,
        createdAt: serverTimestamp(),
      });
    });
    await batch.commit();
  } catch (error) {
    console.error('Error sending bulk notifications:', error);
  }
};

export const sendStandardNotification = async (standard: string, notification: Omit<Notification, 'id' | 'createdAt' | 'read' | 'userId' | 'target'>) => {
  try {
    // New efficient way: Send one notification with target
    await sendNotification({
      ...notification,
      target: standard
    });
  } catch (error) {
    console.error('Error sending standard notification:', error);
  }
};

export const subscribeToNotifications = (userProfile: UserProfile, callback: (notifications: Notification[]) => void) => {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  
  const q = query(
    collection(db, 'notifications'),
    where('createdAt', '>=', twentyFourHoursAgo),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(q, (snapshot) => {
    const notifications = snapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Notification[];
    
    // Filter logic: Show if target is 'all', or matches User's House/Standard, or is specifically for this User
    const filtered = notifications.filter(n => 
      n.target === 'all' || 
      n.target === userProfile.standard || 
      n.target === userProfile.houseTeam || 
      n.userId === userProfile.uid
    );
    
    callback(filtered);
  });
};

export const markAsRead = async (notificationId: string) => {
  try {
    await updateDoc(doc(db, 'notifications', notificationId), {
      read: true
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
  }
};

export const markAllAsRead = async (userId: string) => {
  try {
    // Update user profile with lastRead timestamp
    await updateDoc(doc(db, 'users', userId), {
      lastNotificationReadAt: serverTimestamp()
    });
    
    // Also mark individual notifications as read for this user if they exist
    const q = query(collection(db, 'notifications'), where('userId', '==', userId), where('read', '==', false));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const batch = writeBatch(db);
      snapshot.docs.forEach(d => {
        batch.update(d.ref, { read: true });
      });
      await batch.commit();
    }
  } catch (error) {
    console.error('Error marking all as read:', error);
  }
};
