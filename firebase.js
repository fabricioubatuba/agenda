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

// Adicione este trecho no final do arquivo
database.ref('.info/connected').on('value', (snapshot) => {
    if (snapshot.val() === false) {
        console.warn("Offline: sem conexão com o Firebase");
    }
});

// Tratamento global de erros de autenticação
auth.onAuthStateChanged(user => {
    if (!user && window.location.pathname !== '/login.html') {
        console.warn("Usuário não autenticado - redirecionando...");
    }
});
