// =========================================
// 1. Inicialização do Mapa (Sua Configuração Personalizada)
// =========================================

// Defina os bounds iniciais (Limites gerais onde o usuário pode navegar)
var initialBounds = [[-18, -60], [10, -30]];

// Ajuste para telas pequenas (Mobile)
if (window.innerWidth <= 600) {
    initialBounds = [[-16, -62], [4, -23]];
}

// Criação do mapa com as restrições
const map = L.map('map', {
    zoomControl: false,         // Remove os botões de + e - (adicione L.control.zoom() se quiser eles de volta)
    maxZoom: 28,
    minZoom: 1,                 // Valor temporário, será ajustado abaixo
    maxBounds: initialBounds,   // Impede sair dessa área
    maxBoundsViscosity: 1.0     // "Parede sólida": não deixa arrastar nada para fora
}).fitBounds([[-12.5, -45.5], [-2.5, -40.5]]); // Enquadra o Piauí inicialmente

// Trava o zoom mínimo para o usuário não afastar muito a câmera
map.options.minZoom = map.getZoom();

// Ativa o plugin de Hash (atualiza a URL com a posição)
// Requer o script leaflet-hash no HTML
var hash = new L.Hash(map);

// Adicionando a camada base (OpenStreetMap)
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
}).addTo(map);


// =========================================
// 2. Lógica dos Ícones Dinâmicos
// =========================================

function limparTexto(texto) {
    if (!texto) return '';
    return texto.toString()
        .toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/\./g, "")
        .replace(/\s+/g, "_");
}

function obterIcone(feature) {
    let eixoRaw = feature.properties.Eixo || 'padrao';
    let statusRaw = feature.properties.Status_atual;

    if (statusRaw === 'no_progress') {
        statusRaw = 'sem_evolucao';
    }

    const eixoLimpo = limparTexto(eixoRaw);
    const statusLimpo = limparTexto(statusRaw);
    const nomeArquivo = `${eixoLimpo}_${statusLimpo}`;

    return L.icon({
        iconUrl: `icones/icones_camadas/${nomeArquivo}.svg`,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
    });
}


// =========================================
// 3. Configuração dos Popups
// =========================================

function onEachFeatureGeral(feature, layer) {
    if (feature.properties) {
        let popupContent = `<div style="min-width: 200px; font-family: sans-serif;">`;
        
        if(feature.properties.Eixo) {
            popupContent += `<h3 style="margin:0 0 5px 0;">${feature.properties.Eixo}</h3>`;
        } else {
            popupContent += `<h3>Detalhes</h3>`;
        }

        for (const key in feature.properties) {
            if (key !== 'Eixo') { 
                popupContent += `<b>${key}:</b> ${feature.properties[key]}<br>`;
            }
        }
        popupContent += `</div>`;
        layer.bindPopup(popupContent);
    }
}


// =========================================
// 4. Carregamento dos Dados
// =========================================

Promise.all([
    fetch('data/municipios.geojson').then(res => res.json()),
    fetch('data/linhas.geojson').then(res => res.json()),
    fetch('data/pontos.geojson').then(res => res.json())
]).then(([municipiosData, linhasData, pontosData]) => {

    // --- Camada de Municípios ---
    const municipiosLayer = L.geoJSON(municipiosData, {
        style: {
            color: '#999',
            weight: 1,
            fillColor: '#3388ff',
            fillOpacity: 0.1
        },
        onEachFeature: onEachFeatureGeral
    }).addTo(map);

    // --- Camada de Linhas ---
    const linhasLayer = L.geoJSON(linhasData, {
        style: {
            color: '#FF4500',
            weight: 4,
            opacity: 0.8
        },
        onEachFeature: onEachFeatureGeral
    }).addTo(map);

// --- Camada de Pontos (COM CLUSTER/AGRUPAMENTO) ---
    
    // 1. Criamos o grupo de cluster
    const clusterPontos = L.markerClusterGroup({
        showCoverageOnHover: false, // Opcional: não mostra o polígono da área ao passar o mouse
        maxClusterRadius: 50        // Opcional: define o raio de agrupamento (padrão é 80)
    });

    // 2. Criamos a camada GeoJSON (igual antes, mas SEM .addTo(map) no final)
    const pontosGeoJSON = L.geoJSON(pontosData, {
        pointToLayer: function (feature, latlng) {
            return L.marker(latlng, { icon: obterIcone(feature) });
        },
        onEachFeature: onEachFeatureGeral
    });

    // 3. Adicionamos os pontos ao cluster
    clusterPontos.addLayer(pontosGeoJSON);

    // 4. Adicionamos o cluster ao mapa
    map.addLayer(clusterPontos);


    // --- Controle de Camadas ---
    const overlayMaps = {
        "Obras (Pontos)": clusterPontos, // <--- Aqui usamos a variável do CLUSTER, não do GeoJSON
        "Trechos (Linhas)": linhasLayer,
        "Municípios": municipiosLayer
    };

    L.control.layers(null, overlayMaps, { collapsed: false }).addTo(map);

    // REMOVIDO: map.fitBounds(...) 
    // Motivo: Você já definiu o fitBounds fixo no Piauí na inicialização (linha 19).

}).catch(error => {
    console.error("Erro ao carregar os dados:", error);
});