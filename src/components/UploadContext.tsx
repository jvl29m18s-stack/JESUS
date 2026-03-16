import React, { createContext, useContext, useState, useCallback } from 'react';
import { ref, uploadBytesResumable, getDownloadURL, UploadTask } from 'firebase/storage';
import { storage, db } from '../firebase';
import { collection, addDoc, serverTimestamp, updateDoc, doc } from 'firebase/firestore';
import { UserProfile } from '../types';

interface UploadState {
  id: string;
  fileName: string;
  progress: number;
  status: 'uploading' | 'completed' | 'error';
  type: 'academic' | 'event';
  standard?: string;
}

interface UploadContextType {
  activeUploads: UploadState[];
  startUpload: (file: File, type: 'academic' | 'event', metadata: any, userProfile: UserProfile, standard?: string) => void;
  removeUpload: (id: string) => void;
}

const UploadContext = createContext<UploadContextType | undefined>(undefined);

export const UploadProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeUploads, setActiveUploads] = useState<UploadState[]>([]);

  const removeUpload = useCallback((id: string) => {
    setActiveUploads(prev => prev.filter(u => u.id !== id));
  }, []);

  const startUpload = useCallback(async (file: File, type: 'academic' | 'event', metadata: any, userProfile: UserProfile, standard?: string) => {
    const uploadId = Math.random().toString(36).substring(7);
    const fileName = file.name;
    const storagePath = type === 'academic' 
      ? `academics/${standard}/${Date.now()}_${fileName}`
      : `events/${Date.now()}_${fileName}`;
    
    // 1. Create Firestore document immediately (Optimistic UI / WhatsApp style)
    const collectionName = type === 'academic' ? 'academic_content' : 'institution_events';
    const initialDocData = type === 'academic' ? {
      ...metadata,
      url: '', // Placeholder
      standard,
      authorId: userProfile.uid,
      authorName: userProfile.displayName,
      status: 'uploading',
      uploadProgress: 0,
      createdAt: serverTimestamp()
    } : {
      ...metadata,
      videoUrl: '', // Placeholder
      thumbnailUrl: metadata.thumbnailUrl || `https://picsum.photos/seed/${metadata.title}/800/450`,
      authorId: userProfile.uid,
      authorName: userProfile.displayName,
      status: 'uploading',
      uploadProgress: 0,
      createdAt: serverTimestamp()
    };

    let firestoreDocId = '';
    try {
      const docRef = await addDoc(collection(db, collectionName), initialDocData);
      firestoreDocId = docRef.id;
    } catch (err) {
      console.error("Error creating initial document:", err);
      return;
    }

    const storageRef = ref(storage, storagePath);
    const uploadTask = uploadBytesResumable(storageRef, file);

    setActiveUploads(prev => [...prev, {
      id: uploadId,
      fileName,
      progress: 0,
      status: 'uploading',
      type,
      standard
    }]);

    uploadTask.on('state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setActiveUploads(prev => prev.map(u => u.id === uploadId ? { ...u, progress } : u));
        
        // Update Firestore progress occasionally (e.g., every 10%) to avoid too many writes
        if (Math.floor(progress) % 10 === 0) {
          updateDoc(doc(db, collectionName, firestoreDocId), {
            uploadProgress: Math.round(progress)
          }).catch(console.error);
        }
      },
      (error) => {
        console.error("Upload failed:", error);
        setActiveUploads(prev => prev.map(u => u.id === uploadId ? { ...u, status: 'error' } : u));
        updateDoc(doc(db, collectionName, firestoreDocId), {
          status: 'error'
        }).catch(console.error);
      },
      async () => {
        try {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          
          const finalUpdate = type === 'academic' 
            ? { url: downloadURL, status: 'ready', uploadProgress: 100 }
            : { videoUrl: downloadURL, status: 'ready', uploadProgress: 100 };

          await updateDoc(doc(db, collectionName, firestoreDocId), finalUpdate);
          
          setActiveUploads(prev => prev.map(u => u.id === uploadId ? { ...u, status: 'completed', progress: 100 } : u));
          
          // Auto-remove completed upload after 5 seconds
          setTimeout(() => removeUpload(uploadId), 5000);
        } catch (err) {
          console.error("Error finalizing upload:", err);
          setActiveUploads(prev => prev.map(u => u.id === uploadId ? { ...u, status: 'error' } : u));
          updateDoc(doc(db, collectionName, firestoreDocId), {
            status: 'error'
          }).catch(console.error);
        }
      }
    );
  }, [removeUpload]);

  return (
    <UploadContext.Provider value={{ activeUploads, startUpload, removeUpload }}>
      {children}
    </UploadContext.Provider>
  );
};

export const useUploads = () => {
  const context = useContext(UploadContext);
  if (!context) {
    throw new Error('useUploads must be used within an UploadProvider');
  }
  return context;
};
