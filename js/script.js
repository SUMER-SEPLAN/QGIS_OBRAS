// =========================================
// 1. INICIALIZAÇÃO DO MAPA
// =========================================

var initialBounds = [[-18, -60], [10, -30]];
if (window.innerWidth <= 600) {
    initialBounds = [[-16, -62], [4, -23]];
}

const map = L.map('map', {
    zoomControl: false,
    maxZoom: 21,        // Permite zoom profundo (para o satélite)
    minZoom: 6,         // Impede afastar demais
    maxBounds: initialBounds,
    maxBoundsViscosity: 1.0 
}).fitBounds([[-12.5, -45.5], [-2.5, -40.5]]);

var hash = new L.Hash(map);

// =========================================
// 2. CAMADAS BASE (OSM + GOOGLE SATÉLITE)
// =========================================

// MAPA PADRÃO: OpenStreetMap (Limpo)
const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 21,       // Permite o mapa ir até o 21
    maxNativeZoom: 19, // TRUQUE: Só baixa até o 19, depois estica a imagem (Zoom Digital)
    attribution: '© OpenStreetMap'
});

// MAPA SATÉLITE: Google Híbrido (Alta Resolução)
const satelliteLayer = L.tileLayer('http://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
    maxZoom: 21, 
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    attribution: '© Google Maps'
});

// Inicia com o mapa padrão (OSM)
osmLayer.addTo(map);

// =========================================
// 3. MENU DE CONTROLE (BOTÕES NO TOPO)
// =========================================

window.trocarCamadaBase = function(tipo) {
    if (tipo === 'mapa') {
        map.addLayer(osmLayer);
        if (map.hasLayer(satelliteLayer)) map.removeLayer(satelliteLayer);
    } else if (tipo === 'satelite') {
        map.addLayer(satelliteLayer);
        if (map.hasLayer(osmLayer)) map.removeLayer(osmLayer);
    }
};

// =========================================
// 4. ESTILOS E ÍCONES
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
    let statusRaw = feature.properties.Status_atual || 'indefinido';

    if (statusRaw === 'no_progress') {
        statusRaw = 'sem_evolucao';
    }

    const eixoLimpo = limparTexto(eixoRaw);
    const statusLimpo = limparTexto(statusRaw);
    
    const nomeArquivo = `${eixoLimpo}_${statusLimpo}`;

    return L.icon({
        iconUrl: `icones/icones_camadas/${nomeArquivo}.svg`,
        // iconUrl: 'icones/icones_menu/obras.png', // Fallback se precisar
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
    });
}

function styleLinhas(feature) {
    return {
        color: '#FF4500',
        weight: 4,
        opacity: 0.8
    };
}

function onEachFeatureGeral(feature, layer) {
    if (feature.properties) {
        let p = feature.properties;
        let html = `<div class="popup-content" style="min-width: 200px; font-family: sans-serif;">`;
        
        if(p.Eixo) {
            html += `<h3 style="margin:0 0 5px 0;">${p.Eixo}</h3>`;
        } else {
            html += `<h3>Detalhes</h3>`;
        }
        
        // Campos técnicos para esconder
        const ignorar = ['id', 'fid', 'geometry', 'project_id', 'element_name', 'origem', 'tipo_geo', 'COD_IBGE_COMPOSTO', 'tags', 'provisory', 'definitive'];
        
        for (const key in p) {
            if (!ignorar.includes(key) && p[key] && key !== 'Eixo') {
                 html += `<b>${key}:</b> ${p[key]}<br>`;
            }
        }
        html += `</div>`;
        layer.bindPopup(html);
    }
}

// =========================================
// 5. CARREGAMENTO DOS DADOS
// =========================================

window.clusterPontos = L.markerClusterGroup({
    showCoverageOnHover: false,
    maxClusterRadius: 30,
    disableClusteringAtZoom: 13,
    spiderfyOnMaxZoom: true
});
map.addLayer(window.clusterPontos);

window.linhasLayer = L.geoJSON(null, {
    style: styleLinhas,
    onEachFeature: onEachFeatureGeral
});
map.addLayer(window.linhasLayer);

Promise.all([
    fetch('data/municipios.geojson').then(res => res.json()),
    fetch('data/linhas.geojson').then(res => res.json()),
    fetch('data/pontos.geojson').then(res => res.json())
]).then(([municipiosData, linhasDataLocal, pontosDataLocal]) => {

    // A. MUNICÍPIOS
    L.geoJSON(municipiosData, {
        style: {
            color: '#999',
            weight: 1,
            fillColor: '#3388ff',
            fillOpacity: 0.1
        },
        onEachFeature: function(feature, layer) {
             if(feature.properties && feature.properties.nm_mun) {
                 layer.bindTooltip(feature.properties.nm_mun);
             }
        }
    }).addTo(map);

    // B. SALVAR DADOS GLOBAIS
    window.dadosGlobais = {
        pontos: pontosDataLocal,
        linhas: linhasDataLocal
    };

    // C. POVOAR O MAPA
    window.linhasLayer.addData(linhasDataLocal);

    const pontosGeoJSON = L.geoJSON(pontosDataLocal, {
        pointToLayer: function (feature, latlng) {
            return L.marker(latlng, { icon: obterIcone(feature) });
        },
        onEachFeature: onEachFeatureGeral
    });
    window.clusterPontos.addLayer(pontosGeoJSON);

    // D. INICIALIZAR FILTROS
    inicializarFiltros();

}).catch(error => {
    console.error("ERRO FATAL ao carregar GeoJSON:", error);
});


// =========================================
// 6. LÓGICA DE FILTROS
// =========================================

const listaTerritorios = [
    "CARNAUBAIS", "CHAPADA DAS MANGABEIRAS", "CHAPADA VALE DO ITAIM", "COCAIS",
    "ENTRE-RIOS", "PLANÍCIE LITORÂNEA", "SERRA DA CAPIVARA", "TABULEIRO DO ALTO PARNAÍBA",
    "VALE DO RIO CANINDÉ", "VALE DO RIO GUARIBAS", "VALE DO RIO SAMBITO",
    "VALE DOS RIOS PIAUÍ E ITAUEIRAS"
];

const listaMunicipios = [
    "ACAUÃ", "AGRICOLÂNDIA", "ALAGOINHA DO PIAUÍ", "ALEGRETE DO PIAUÍ", "ALTO LONGÁ", "ALTOS", "ALVORADA DO GURGUÉIA", "AMARANTE", "ANGICAL DO PIAUÍ", "ANTÔNIO ALMEIDA", "ANÍSIO DE ABREU", "AROAZES", "AROEIRAS DO ITAIM", "ARRAIAL", "ASSUNÇÃO DO PIAUÍ", "AVELINO LOPES", "BAIXA GRANDE DO RIBEIRO", "BARRA D'ALCÂNTARA", "BARRAS", "BARREIRAS DO PIAUÍ", "BARRO DURO", "BATALHA", "BELA VISTA DO PIAUÍ", "BELÉM DO PIAUÍ", "BENEDITINOS", "BERTOLÍNIA", "BETÂNIA DO PIAUÍ", "BOA HORA", "BOCAINA", "BOM JESUS", "BOM PRINCÍPIO DO PIAUÍ", "BONFIM DO PIAUÍ", "BOQUEIRÃO DO PIAUÍ", "BRASILEIRA", "BREJO DO PIAUÍ", "BURITI DOS LOPES", "BURITI DOS MONTES", "CABECEIRAS DO PIAUÍ", "CAJAZEIRAS DO PIAUÍ", "CAJUEIRO DA PRAIA", "CALDEIRÃO GRANDE DO PIAUÍ", "CAMPINAS DO PIAUÍ", "CAMPO ALEGRE DO FIDALGO", "CAMPO GRANDE DO PIAUÍ", "CAMPO LARGO DO PIAUÍ", "CAMPO MAIOR", "CANAVIEIRA", "CANTO DO BURITI", "CAPITÃO DE CAMPOS", "CAPITÃO GERVÁSIO OLIVEIRA", "CARACOL", "CARAÚBAS DO PIAUÍ", "CARIDADE DO PIAUÍ", "CASTELO DO PIAUÍ", "CAXINGÓ", "COCAL", "COCAL DE TELHA", "COCAL DOS ALVES", "COIVARAS", "COLÔNIA DO GURGUÉIA", "COLÔNIA DO PIAUÍ", "CONCEIÇÃO DO CANINDÉ", "CORONEL JOSÉ DIAS", "CORRENTE", "CRISTALÂNDIA DO PIAUÍ", "CRISTINO CASTRO", "CURIMATÁ", "CURRAIS", "CURRAL NOVO DO PIAUÍ", "CURRALINHOS", "DEMERVAL LOBÃO", "DIRCEU ARCOVERDE", "DOM EXPEDITO LOPES", "DOM INOCÊNCIO", "DOMINGOS MOURÃO", "ELESBÃO VELOSO", "ELISEU MARTINS", "ESPERANTINA", "FARTURA DO PIAUÍ", "FLORES DO PIAUÍ", "FLORESTA DO PIAUÍ", "FLORIANO", "FRANCINÓPOLIS", "FRANCISCO AYRES", "FRANCISCO MACEDO", "FRANCISCO SANTOS", "FRONTEIRAS", "GEMINIANO", "GILBUÉS", "GUADALUPE", "GUARIBAS", "HUGO NAPOLEÃO", "ILHA GRANDE", "INHUMA", "IPIRANGA DO PIAUÍ", "ISAÍAS COELHO", "ITAINÓPOLIS", "ITAUEIRA", "JACOBINA DO PIAUÍ", "JAICÓS", "JARDIM DO MULATO", "JATOBÁ DO PIAUÍ", "JERUMENHA", "JOAQUIM PIRES", "JOCA MARQUES", "JOSÉ DE FREITAS", "JOÃO COSTA", "JUAZEIRO DO PIAUÍ", "JUREMA", "JÚLIO BORGES", "LAGOA ALEGRE", "LAGOA DE SÃO FRANCISCO", "LAGOA DO BARRO DO PIAUÍ", "LAGOA DO PIAUÍ", "LAGOA DO SÍTIO", "LAGOINHA DO PIAUÍ", "LANDRI SALES", "LUZILÂNDIA", "LUÍS CORREIA", "MADEIRO", "MANOEL EMÍDIO", "MARCOLÂNDIA", "MARCOS PARENTE", "MASSAPÊ DO PIAUÍ", "MATIAS OLÍMPIO", "MIGUEL ALVES", "MIGUEL LEÃO", "MILTON BRANDÃO", "MONSENHOR GIL", "MONSENHOR HIPÓLITO", "MONTE ALEGRE DO PIAUÍ", "MORRO CABEÇA NO TEMPO", "MORRO DO CHAPÉU DO PIAUÍ", "MURICI DOS PORTELAS", "NAZARÉ DO PIAUÍ", "NAZÁRIA", "NOSSA SENHORA DE NAZARÉ", "NOSSA SENHORA DOS REMÉDIOS", "NOVA SANTA RITA", "NOVO ORIENTE DO PIAUÍ", "NOVO SANTO ANTÔNIO", "OEIRAS", "OLHO D'ÁGUA DO PIAUÍ", "PADRE MARCOS", "PAES LANDIM", "PAJEÚ DO PIAUÍ", "PALMEIRA DO PIAUÍ", "PALMEIRAIS", "PAQUETÁ", "PARNAGUÁ", "PARNAÍBA", "PASSAGEM FRANCA DO PIAUÍ", "PATOS DO PIAUÍ", "PAU D'ARCO DO PIAUÍ", "PAULISTANA", "PAVUSSU", "PEDRO II", "PEDRO LAURENTINO", "PICOS", "PIMENTEIRAS", "PIO IX", "PIRACURUCA", "PIRIPIRI", "PORTO", "PORTO ALEGRE DO PIAUÍ", "PRATA DO PIAUÍ", "QUEIMADA NOVA", "REDENÇÃO DO GURGUÉIA", "REGENERAÇÃO", "RIACHO FRIO", "RIBEIRA DO PIAUÍ", "RIBEIRO GONÇALVES", "RIO GRANDE DO PIAUÍ", "SANTA CRUZ DO PIAUÍ", "SANTA CRUZ DOS MILAGRES", "SANTA FILOMENA", "SANTA LUZ", "SANTA ROSA DO PIAUÍ", "SANTANA DO PIAUÍ", "SANTO ANTÔNIO DE LISBOA", "SANTO ANTÔNIO DOS MILAGRES", "SANTO INÁCIO DO PIAUÍ", "SEBASTIÃO BARROS", "SEBASTIÃO LEAL", "SIGEFREDO PACHECO", "SIMPLÍCIO MENDES", "SIMÕES", "SOCORRO DO PIAUÍ", "SUSSUAPARA", "SÃO BRAZ DO PIAUÍ", "SÃO FRANCISCO DE ASSIS DO PIAUÍ", "SÃO FRANCISCO DO PIAUÍ", "SÃO FÉLIX DO PIAUÍ", "SÃO GONÇALO DO GURGUÉIA", "SÃO GONÇALO DO PIAUÍ", "SÃO JOSÉ DO DIVINO", "SÃO JOSÉ DO PEIXE", "SÃO JOSÉ DO PIAUÍ", "SÃO JOÃO DA CANABRAVA", "SÃO JOÃO DA FRONTEIRA", "SÃO JOÃO DA SERRA", "SÃO JOÃO DA VARJOTA", "SÃO JOÃO DO ARRAIAL", "SÃO JOÃO DO PIAUÍ", "SÃO JULIÃO", "SÃO LOURENÇO DO PIAUÍ", "SÃO LUIS DO PIAUÍ", "SÃO MIGUEL DA BAIXA GRANDE", "SÃO MIGUEL DO FIDALGO", "SÃO MIGUEL DO TAPUIO", "SÃO PEDRO DO PIAUÍ", "SÃO RAIMUNDO NONATO", "TAMBORIL DO PIAUÍ", "TANQUE DO PIAUÍ", "TERESINA", "UNIÃO", "URUÇUÍ", "VALENÇA DO PIAUÍ", "VERA MENDES", "VILA NOVA DO PIAUÍ", "VÁRZEA BRANCA", "VÁRZEA GRANDE", "WALL FERRAZ", "ÁGUA BRANCA"
];

function inicializarFiltros() {
    if (!window.parent || !window.parent.document) {
        console.warn("Aviso: Filtros não encontrados.");
        return;
    }

    preencherSelect('filtro-municipio', listaMunicipios);
    preencherSelect('filtro-territorio', listaTerritorios);

    if (!window.dadosGlobais) return;
    
    const todosDados = [];
    if (window.dadosGlobais.pontos) todosDados.push(...window.dadosGlobais.pontos.features);
    if (window.dadosGlobais.linhas) todosDados.push(...window.dadosGlobais.linhas.features);

    const orgaos = getUniqueValues(todosDados, 'Orgão da Açao');
    const situacoes = getUniqueValues(todosDados, 'Status_atual');
    const classificacoes = getUniqueValues(todosDados, 'CLASSIFICAÇÃO');
    const subClassificacoes = getUniqueValues(todosDados, 'SUB-CLASSIFICAÇÃO OBRA');
    const eixos = getUniqueValues(todosDados, 'Eixo');
    const tipologias = getUniqueValues(todosDados, 'TIPOLOGIA');

    preencherSelect('filtro-orgao', orgaos);
    preencherSelect('filtro-situacao', situacoes);
    preencherSelect('filtro-classificacao', classificacoes);
    preencherSelect('filtro-subclassificacao', subClassificacoes);
    preencherSelect('filtro-eixo', eixos);
    preencherSelect('filtro-tipologia', tipologias);

    if (window.parent.iniciarSlimSelect) {
        window.parent.iniciarSlimSelect();
    }
}

function getUniqueValues(features, propName) {
    const values = new Set();
    features.forEach(f => {
        let val = f.properties[propName];
        if (!val) {
            const keys = Object.keys(f.properties);
            const keyParecida = keys.find(k => k.toLowerCase() === propName.toLowerCase());
            if (keyParecida) val = f.properties[keyParecida];
        }
        if(val) values.add(val.toString().trim());
    });
    return Array.from(values).sort();
}

function preencherSelect(id, arrayValores) {
    const select = window.parent.document.getElementById(id);
    if (!select) return; 
    select.innerHTML = "";
    arrayValores.forEach(valor => {
        const option = window.parent.document.createElement('option');
        option.value = valor;
        option.text = valor;
        select.appendChild(option);
    });
}

function aplicarFiltros() {
    const docPai = window.parent.document;

    function getSelectedValues(id) {
        const select = docPai.getElementById(id);
        return select ? Array.from(select.selectedOptions).map(opt => opt.value) : [];
    }

    const filtros = {
        municipio: getSelectedValues('filtro-municipio'),
        territorio: getSelectedValues('filtro-territorio'),
        orgao: getSelectedValues('filtro-orgao'),
        situacao: getSelectedValues('filtro-situacao'),
        eixo: getSelectedValues('filtro-eixo'),
        classificacao: getSelectedValues('filtro-classificacao'),
        subclassificacao: getSelectedValues('filtro-subclassificacao'),
        tipologia: getSelectedValues('filtro-tipologia')
    };

    console.log("Aplicando filtros:", filtros);

    window.clusterPontos.clearLayers();
    window.linhasLayer.clearLayers();
    
    const pontosDataLocal = window.dadosGlobais.pontos;
    const linhasDataLocal = window.dadosGlobais.linhas;

    if (pontosDataLocal) {
        const pontosFiltrados = pontosDataLocal.features.filter(f => checarFiltro(f, filtros));
        const novosPontosGeoJSON = L.geoJSON(pontosFiltrados, {
            pointToLayer: function (feature, latlng) {
                return L.marker(latlng, { icon: obterIcone(feature) });
            },
            onEachFeature: onEachFeatureGeral
        });
        window.clusterPontos.addLayer(novosPontosGeoJSON);
    }

    if (linhasDataLocal) {
        const linhasFiltradas = linhasDataLocal.features.filter(f => checarFiltro(f, filtros));
        window.linhasLayer.addData(linhasFiltradas);
    }

    const sidebar = docPai.getElementById('sidebar-container');
    if(window.innerWidth <= 600 && sidebar) {
        sidebar.classList.add('closed');
    }
}

function checarFiltro(feature, filtros) {
    const p = feature.properties;

    const getVal = (chave) => {
        let v = p[chave];
        if(!v) {
            const k = Object.keys(p).find(key => key.toLowerCase() === chave.toLowerCase());
            if(k) v = p[k];
        }
        return v ? v.toString().trim() : "";
    };

    const munDados = getVal('Localizacao (municipio)').toUpperCase();
    const terrDados = getVal('TERRITORIO_COMPOSTO').toUpperCase(); 
    const orgaoDados = getVal('Orgão da Açao');
    const sitDados = getVal('Status_atual');
    const eixoDados = getVal('Eixo');
    const classDados = getVal('CLASSIFICAÇÃO');
    const subClassDados = getVal('SUB-CLASSIFICAÇÃO OBRA');
    const tipoDados = getVal('TIPOLOGIA');

    // 1. Municípios
    if (filtros.municipio.length > 0) {
        const match = filtros.municipio.some(filtro => munDados.includes(filtro.toUpperCase()));
        if (!match) return false;
    }

    // 2. Territórios
    if (filtros.territorio.length > 0) {
        const match = filtros.territorio.some(filtro => terrDados.includes(filtro.toUpperCase()));
        if (!match) return false;
    }

    // 3. Outros Filtros
    if (filtros.orgao.length > 0 && !filtros.orgao.includes(orgaoDados)) return false;
    if (filtros.situacao.length > 0 && !filtros.situacao.includes(sitDados)) return false;
    if (filtros.eixo.length > 0 && !filtros.eixo.includes(eixoDados)) return false;
    if (filtros.classificacao.length > 0 && !filtros.classificacao.includes(classDados)) return false;
    if (filtros.subclassificacao.length > 0 && !filtros.subclassificacao.includes(subClassDados)) return false;
    if (filtros.tipologia.length > 0 && !filtros.tipologia.includes(tipoDados)) return false;

    return true;
}

function limparFiltros() {
    const docPai = window.parent.document;
    docPai.getElementById('form-filtros').reset();
    if (window.parent.iniciarSlimSelect) window.parent.iniciarSlimSelect();
    aplicarFiltros();
}

window.parent.aplicarFiltros = aplicarFiltros;
window.parent.limparFiltros = limparFiltros;