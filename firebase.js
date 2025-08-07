// Configuração do Firebase
const firebaseConfig = {
    apiKey: "AIzaSyArt1k0NSeuHD9qjEHbC9zJNEr331_Zk0A",
    authDomain: "agendains.firebaseapp.com",
    databaseURL: "https://agendains-default-rtdb.firebaseio.com",
    projectId: "agendains",
    storageBucket: "agendains.appspot.com",
    messagingSenderId: "1060898205140",
    appId: "1:1060898205140:web:994bd3b9e9e5677168ba41"
};

// Inicialização
const app = firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const auth = firebase.auth();

// Configura persistência e monitoramento de conexão
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
    .catch(error => console.error("Erro de persistência:", error));

// Monitora estado da conexão
database.ref('.info/connected').on('value', (snapshot) => {
    if (!snapshot.val()) showAlert("Você está offline. Algumas funcionalidades podem não estar disponíveis.", "warning");
});
