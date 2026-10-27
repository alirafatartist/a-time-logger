import {initializeApp} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {getAuth} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {initializeFirestore,persistentLocalCache} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import {firebaseConfig} from "./config.js";
export const configured=!!firebaseConfig.apiKey&&!firebaseConfig.apiKey.startsWith("YOUR");
const app=configured?initializeApp(firebaseConfig):null;
export const auth=app&&getAuth(app);
export const db=app&&initializeFirestore(app,{localCache:persistentLocalCache()});
