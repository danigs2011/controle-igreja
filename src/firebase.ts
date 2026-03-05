import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "COLE_AQUI",
    authDomain: "COLE_AQUI",
      projectId: "controle-igreja-c82bf",
        storageBucket: "COLE_AQUI",
          messagingSenderId: "797570534344",
            appId: "COLE_AQUI",
              measurementId: "G-LNFNKRKY68"
              };

              const app = initializeApp(firebaseConfig);
              export const db = getFirestore(app);
              