// =========================================
// 1. Inicialização do Mapa (Sua Configuração)
// =========================================

var initialBounds = [[-18, -60], [10, -30]];

if (window.innerWidth <= 600) {
    initialBounds = [[-16, -62], [4, -23]];
}

const map = L.map('map', {
    zoomControl: false,
    maxZoom: 28,
    minZoom: 1,
    maxBounds: initialBounds,
    maxBoundsViscosity: 1.0
}).fitBounds([[-12.5, -45.5], [-2.5, -40.5]]);

map.options.minZoom = map.getZoom();

var hash = new L.Hash(map);


// =========================================
// 2. Definição das Camadas Base (Mapa e Satélite)
// =========================================

// Camada 1: OpenStreetMap (Padrão)
const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
});

// Camada 2: Satélite (Esri World Imagery)
const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles © Esri — Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
});

// Adiciona o OSM como padrão ao iniciar
osmLayer.addTo(map);


// =========================================
// 3. Lógica dos Ícones Dinâmicos
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
// 4. Configuração dos Popups
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
// 5. Carregamento dos Dados
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

// --- Camada de Pontos (COM CLUSTER AGRESSIVO) ---
    const clusterPontos = L.markerClusterGroup({
        showCoverageOnHover: false,
        
        // Raio bem pequeno: só agrupa se os pontos estiverem "colados"
        maxClusterRadius: 30, 

        // Assim que chegar no nível de Zoom 13 (visão geral da cidade), 
        // ele DESATIVA o agrupamento e mostra todos os ícones soltos.
        disableClusteringAtZoom: 13,
        
        // Se houver pontos EXATAMENTE na mesma coordenada geográfica,
        // ele ainda vai agrupar (pois é impossível mostrar um em cima do outro).
        // Ao clicar, ele espalha (efeito aranha).
        spiderfyOnMaxZoom: true 
    });

    const pontosGeoJSON = L.geoJSON(pontosData, {
        pointToLayer: function (feature, latlng) {
            return L.marker(latlng, { icon: obterIcone(feature) });
        },
        onEachFeature: onEachFeatureGeral
    });

    clusterPontos.addLayer(pontosGeoJSON);
    map.addLayer(clusterPontos);


    // =========================================
    // 6. Controle de Camadas (Base + Overlays)
    // =========================================
    
    // Define as opções de fundo (radio buttons)
    const baseMaps = {
        "Mapa Padrão": osmLayer,
        "Satélite": satelliteLayer
    };

    // Define as opções de sobreposição (checkboxes)
    const overlayMaps = {
        "Obras (Pontos)": clusterPontos,
        "Trechos (Linhas)": linhasLayer,
        "Municípios": municipiosLayer
    };

    // Adiciona o controle atualizado
    // O primeiro parâmetro agora é 'baseMaps' (não mais null)
    L.control.layers(baseMaps, overlayMaps, { collapsed: false }).addTo(map);

}).catch(error => {
    console.error("Erro ao carregar os dados:", error);
});