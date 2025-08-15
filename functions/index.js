/**
 * Import necessary Firebase Admin SDK modules.
 * The Firebase Admin SDK lets you interact with Firebase from privileged environments
 * (like a server or cloud function) to perform actions like deleting users.
 */
const { onCall } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");

// Initialize the Firebase Admin SDK
initializeApp();

/**
 * This is a 'Callable Cloud Function'. It can be called directly from your web app.
 * It's designed to delete a user securely.
 *
 * @param {object} request - The request object from your app. It contains the data
 * sent from the client, including the UID of the user to delete
 * and the authentication token of the admin making the request.
 */
exports.deleteUser = onCall(async (request) => {
  // Check if the user making the request is an admin. This is a crucial security check.
  // The 'auth' object contains the decoded token of the user who called the function.
  if (request.auth.token.role !== 'admin') {
    // If the user is not an admin, throw an error. This prevents non-admins
    // from deleting users.
    throw new functions.https.HttpsError(
      'permission-denied', 
      'Only administrators can delete users.'
    );
  }

  // Get the UID of the user to be deleted from the data sent by the client app.
  const uid = request.data.uid;
  if (!uid) {
    // If no UID was provided, throw an error.
    throw new functions.https.HttpsError(
      'invalid-argument', 
      'The function must be called with a "uid" argument.'
    );
  }

  try {
    // Use the Admin SDK to delete the user from Firebase Authentication.
    await getAuth().deleteUser(uid);
    
    // Use the Admin SDK to delete the user's record from the Firestore database.
    await getFirestore().collection('users').doc(uid).delete();
    
    // If both actions succeed, return a success message.
    return { success: true, message: `Successfully deleted user ${uid}` };
  } catch (error) {
    // If any part of the process fails, log the error for debugging
    // and throw an error back to the client app.
    console.error("Error deleting user:", error);
    throw new functions.https.HttpsError(
      'internal', 
      'An error occurred while trying to delete the user.'
    );
  }
});
