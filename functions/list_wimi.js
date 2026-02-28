const axios = require("axios");

const API_KEY = "6811889D-5911-76A7-CE20-8BB658B445E6";
const BASE_URL = "https://paniscope.wimi.pro/wapi/v2";

async function listWorkspaces() {
  try {
    const response = await axios.post(`${BASE_URL}/project.list`, {
      api_key: API_KEY,
    });

    console.log("--- VOS ESPACES DE TRAVAIL WIMI ---");
    if (response.data && response.data.projects) {
      response.data.projects.forEach((p) => {
        console.log(`ID: ${p.id} | NOM: ${p.name}`);
      });
    } else {
      console.log("Aucun espace trouvé ou erreur:", response.data);
    }
  } catch (error) {
    console.error("Erreur lors de la connexion à Wimi:", error.message);
  }
}

listWorkspaces();
