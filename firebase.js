// Configuração do Firebase
const firebaseConfig = {
    apiKey: "AIzaSyArt1k0NSeuHD9qjEHbC9zJNEr331_Zk0A",
    authDomain: "agendains.firebaseapp.com",
    projectId: "agendains",
    storageBucket: "agendains.appspot.com",
    messagingSenderId: "1060898205140",
    appId: "1:1060898205140:web:994bd3b9e9e5677168ba41",
    databaseURL: "https://agendains-default-rtdb.firebaseio.com/"
};

// Inicializa o Firebase
const app = firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const auth = firebase.auth();

// Configura o persistence para evitar erro de sessionStorage
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
    .catch((error) => {
        console.error("Erro ao configurar persistence:", error);
    });
