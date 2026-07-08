// js/config.js
//
// Troque a linha abaixo pela URL do backend depois de hospedá-lo
// (ex: Render, Railway). Enquanto estiver rodando local, deixe como está.
//
// Exemplo depois do deploy:
// const API_URL = "https://modelo-almoxarifado-backend.onrender.com/api";

const API_URL = (location.hostname === "localhost" || location.hostname === "127.0.0.1")
  ? "http://localhost:3001/api"
  : "https://TROQUE-PELA-URL-DO-SEU-BACKEND.onrender.com/api";
