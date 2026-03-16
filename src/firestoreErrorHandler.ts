import { auth } from './firebase';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: any, operationType: OperationType, path: string | null) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  const errInfo: FirestoreErrorInfo = {
    error: errorMessage,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  
  const errorString = JSON.stringify(errInfo);
  console.error('Firestore Error: ', errorString);
  
  // Categorize errors for better UI feedback
  let userMessage = 'An unexpected database error occurred.';
  let isRecoverable = true;

  if (errorMessage.includes('permission-denied') || errorMessage.includes('Missing or insufficient permissions')) {
    userMessage = 'You do not have permission to perform this action.';
    isRecoverable = false;
  } else if (errorMessage.includes('unavailable') || errorMessage.includes('failed-precondition') || errorMessage.includes('transport errored')) {
    userMessage = 'Connection to database lost. Retrying...';
  } else if (errorMessage.includes('quota-exceeded')) {
    userMessage = 'Database quota exceeded. Please try again later.';
    isRecoverable = false;
  }

  // Dispatch event for UI components to listen to
  window.dispatchEvent(new CustomEvent('firestore-error-event', { 
    detail: { ...errInfo, userMessage, isRecoverable } 
  }));

  // Only throw if it's a critical permission error that should stop execution
  if (!isRecoverable) {
    throw new Error(errorString);
  }
}
