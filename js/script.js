// =========================================
// 1. INICIALIZAÇÃO DO MAPA PRINCIPAL
// =========================================

var initialBounds = [[-18, -60], [10, -30]];
if (window.innerWidth <= 600) {
    initialBounds = [[-16, -62], [4, -23]];
}

const map = L.map('map', {
    zoomControl: false,
    maxZoom: 21,
    minZoom: 6,
    maxBounds: initialBounds,
    maxBoundsViscosity: 1.0 
}).fitBounds([[-12.5, -45.5], [-2.5, -40.5]]);

var hash = new L.Hash(map);

// =========================================
// 2. CAMADAS BASE
// =========================================

const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 21,
    maxNativeZoom: 19,
    attribution: '© OpenStreetMap'
});

const satelliteLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
    maxZoom: 21, 
    attribution: '© Google Maps'
});

osmLayer.addTo(map);

// =========================================
// 3. MENU DE CONTROLE
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
// 4. ESTILOS, ÍCONES E FORMATADORES
// =========================================

function formatarMoeda(valor) {
    if (!valor || valor === '0') return 'Não informado';
    return parseFloat(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarData(dataStr) {
    if (!dataStr) return '-';
    const dataLimpa = dataStr.split(' ')[0]; 
    const partes = dataLimpa.split('-');
    if (partes.length === 3) {
        return `${partes[2]}/${partes[1]}/${partes[0]}`;
    }
    return dataStr;
}

function formatarPorcentagem(valor) {
    if (valor === null || valor === undefined || valor === '') return 0;
    return parseFloat(valor).toFixed(1).replace('.', ',');
}

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

    if (statusRaw === 'no_progress') statusRaw = 'sem_evolucao';

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

function styleLinhas(feature) {
    return { color: '#FF4500', weight: 4, opacity: 0.8 };
}

// =========================================
// FUNÇÃO ESPECIAL: MINI-MAPA NO SIDEBAR
// =========================================
window.miniMapInstance = null; 

function renderizarMiniMapaMunicipios(codigosIbgeString) {
    try {
        if (window.miniMapInstance) {
            window.miniMapInstance.remove();
            window.miniMapInstance = null;
        }
    } catch (e) { console.log("Limpando referência antiga do mapa"); }

    let alvos = [];
    if (codigosIbgeString) {
        alvos = String(codigosIbgeString).split('-').map(c => c.trim());
    }

    if (!window.parent || !window.parent.document) return;
    const containerMiniMapa = window.parent.document.getElementById('mini-mapa-container');

    if (!containerMiniMapa) {
        console.warn("Container do mini-mapa não encontrado. Tentando novamente em 100ms...");
        setTimeout(() => renderizarMiniMapaMunicipios(codigosIbgeString), 100);
        return;
    }

    try {
        window.miniMapInstance = L.map(containerMiniMapa, {
            zoomControl: false,
            attributionControl: false,
            dragging: false,
            scrollWheelZoom: false,
            doubleClickZoom: false,
            boxZoom: false,
            trackResize: false
        });

        if (window.dadosGlobais && window.dadosGlobais.municipios) {
            
            const layerMunicipios = L.geoJSON(window.dadosGlobais.municipios, {
                style: function(feature) {
                    const p = feature.properties;
                    const codigoGeo = String(
                        p['Código do IBGE'] || 
                        p['COD_IBGE'] || 
                        p['CD_MUN'] || 
                        p['id'] || 
                        ''
                    );
                    
                    const isTarget = alvos.includes(codigoGeo);

                    return {
                        fillColor: isTarget ? '#0352AA' : '#e0e0e0', // Azul se for o alvo
                        color: isTarget ? '#0352AA' : '#ffffff',     // Borda Azul ou Branca
                        weight: isTarget ? 1 : 0.5,
                        fillOpacity: 1,
                        opacity: 1
                    };
                }
            }).addTo(window.miniMapInstance);

            if (alvos.length > 0) {
                const layersAlvo = layerMunicipios.getLayers().filter(l => {
                    const p = l.feature.properties;
                    const codigoGeo = String(p['Código do IBGE'] || p['COD_IBGE'] || p['CD_MUN'] || '');
                    return alvos.includes(codigoGeo);
                });

                if (layersAlvo.length > 0) {
                    const featureGroup = L.featureGroup(layersAlvo);
                    setTimeout(() => {
                        window.miniMapInstance.invalidateSize();
                        // Padding 100 para afastar o zoom
                        window.miniMapInstance.fitBounds(featureGroup.getBounds(), { padding: [100, 100] });
                    }, 200);
                } else {
                    window.miniMapInstance.fitBounds(layerMunicipios.getBounds());
                }
            } else {
                window.miniMapInstance.fitBounds(layerMunicipios.getBounds());
            }
        }
    } catch (error) {
        console.error("Erro ao renderizar mini-mapa:", error);
    }
}


// --- FUNÇÃO PARA ABRIR DETALHES NA SIDEBAR ---
window.todasObras = {}; 

window.abrirDetalhesSidebar = function(id) {
    const p = window.todasObras[id];
    if (!p) return;

    const docPai = window.parent.document;
    const divConteudo = docPai.getElementById('conteudo-detalhes');
    const sidebar = docPai.getElementById('sidebar-container');
    
    if (!divConteudo || !sidebar) return;

    sidebar.classList.remove('closed');

    docPai.querySelectorAll('.icon-item').forEach(i => i.classList.remove('active'));
    docPai.querySelectorAll('.panel-section').forEach(pan => pan.classList.remove('active'));
    
    const abaObras = docPai.querySelector('[data-target="panel-obras"]');
    if(abaObras) abaObras.classList.add('active');
    
    const panelObras = docPai.getElementById('panel-obras');
    if(panelObras) panelObras.classList.add('active');

    const campos = [
        { chave: 'project_id', label: 'ID da Ação' },
        { chave: 'Eixo', label: 'Eixo' },
        { chave: 'Nome da Ação', label: 'Nome da Ação' },
        { chave: 'Orgão da Açao', label: 'Órgão Responsável' },
        { chave: 'Status_atual', label: 'Situação Atual' },
        
        // Data de Criação REMOVIDA
        { chave: 'Data Inicio', label: 'Data de Início', tipo: 'data' },
        { chave: 'Data Final', label: 'Data Final', tipo: 'data' },
        { chave: 'Prazo de conclusão', label: 'Prazo de Conclusão', tipo: 'data' },
        { chave: 'Data da OS', label: 'Data da OS', tipo: 'data' },
        { chave: 'data_celebracao', label: 'Data de Celebração', tipo: 'data' },
        { chave: 'data_inicio_vigencia', label: 'Início da Vigência', tipo: 'data' },
        { chave: 'data_fim_vigencia_total', label: 'Fim da Vigência', tipo: 'data' },

        // Financeiro
        { chave: 'Orçamento previsto total', label: 'Orçamento Previsto', tipo: 'moeda' },
        { chave: 'valor_contrato', label: 'Valor do Contrato', tipo: 'moeda' },
        { chave: 'valor_pago', label: 'Valor Pago', tipo: 'moeda' },

        // Técnicos
        { chave: 'CLASSIFICAÇÃO', label: 'Classificação' },
        { chave: 'SUB-CLASSIFICAÇÃO OBRA', label: 'Sub-Classificação' },
        { chave: 'TIPOLOGIA', label: 'Tipologia' },
        { chave: 'RECEBIMENTO', label: 'Data do Recebimento', tipo: 'data' },
        
        // Localização no final
        { chave: 'Localizacao (municipio)', label: 'Localização' } 
    ];

    let html = '';
    let perc = p['Percentual de Execução da Ação'] ? parseFloat(p['Percentual de Execução da Ação']) : 0;
    let percTexto = formatarPorcentagem(p['Percentual de Execução da Ação']);
    
    html += `<div class="detalhe-item">
                <strong>Percentual de Execução</strong>
                <div class="progress-container">
                    <div class="progress-bar" style="width: ${perc}%"></div>
                </div>
                <span style="font-size:12px; text-align:right; color:#555; display:block;">${percTexto}% Concluído</span>
             </div>`;

    campos.forEach(campo => {
        let valor = p[campo.chave];
        if (valor !== null && valor !== undefined && valor !== '') {
            if (campo.tipo === 'moeda') valor = formatarMoeda(valor);
            if (campo.tipo === 'data') valor = formatarData(valor);
            html += `<div class="detalhe-item"><strong>${campo.label}</strong><span>${valor}</span></div>`;
        }
    });

    // Injeta a DIV do mapa
    html += `<div class="detalhe-item" style="border:none; margin-top:20px; clear:both; width:100%;">
                <strong style="display:block; margin-bottom:10px;">Mapa de Localização</strong>
                <div id="mini-mapa-container"></div>
             </div>`;

    divConteudo.innerHTML = html;
    
    const contentPanel = docPai.querySelector('.content-panel');
    if(contentPanel) contentPanel.scrollTop = 0;

    // Chama o renderizador com um pequeno delay para a DIV existir no DOM
    setTimeout(() => {
        renderizarMiniMapaMunicipios(p['COD_IBGE_COMPOSTO']);
    }, 200);
};

// --- CONFIGURAÇÃO DO POPUP ---
function onEachFeatureGeral(feature, layer) {
    if (feature.properties) {
        const p = feature.properties;
        const idRaw = p['fid'] || p['id'] || Math.random();
        const idUnico = String(idRaw).replace(/['"]/g, ""); 
        
        window.todasObras[idUnico] = p;

        let html = `<div class="popup-content" style="min-width: 230px; font-family: 'Segoe UI', sans-serif; font-size: 13px;">`;
        if(p.Eixo) {
            html += `<h3 style="margin: 0 0 10px 0; color: #0352AA; border-bottom: 2px solid #eee; padding-bottom: 8px; font-size: 14px;">${p.Eixo}</h3>`;
        }

        const linhaStyle = "margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid #f0f0f0; line-height: 1.4;";

        if(p['project_id']) 
            html += `<div style="${linhaStyle}"><strong style="color:#555;">ID da Ação:</strong> ${p['project_id']}</div>`;
        if(p['Nome da Ação']) 
            html += `<div style="${linhaStyle}"><strong style="color:#555;">Ação:</strong><br>${p['Nome da Ação']}</div>`;
        if(p['Orgão da Açao']) 
            html += `<div style="${linhaStyle}"><strong style="color:#555;">Órgão:</strong> ${p['Orgão da Açao']}</div>`;
        
        // Orçamento Previsto REMOVIDO DAQUI

        html += `<button class="btn-ver-mais" onclick="window.abrirDetalhesSidebar('${idUnico}')">Detalhes</button>`;
        html += `</div>`;
        
        layer.bindPopup(html, { closeButton: false });

        let timer;
        layer.on('mouseover', function (e) { clearTimeout(timer); this.openPopup(); });
        layer.on('mouseout', function (e) { timer = setTimeout(() => { this.closePopup(); }, 300); });
        layer.on('popupopen', function (e) {
            const popupNode = e.popup._container; 
            if (popupNode) {
                L.DomEvent.on(popupNode, 'mouseenter', () => { clearTimeout(timer); });
                L.DomEvent.on(popupNode, 'mouseleave', () => { timer = setTimeout(() => { this.closePopup(); }, 300); });
            }
        });
    }
}

// =========================================
// 5. CARREGAMENTO DOS DADOS
// =========================================

window.clusterPontos = L.markerClusterGroup({
    showCoverageOnHover: false,
    maxClusterRadius: 30,
    disableClusteringAtZoom: 13,
    spiderfyOnMaxZoom: true,
    iconCreateFunction: function(cluster) {
        var childCount = cluster.getChildCount();
        var c = ' marker-cluster-';
        if (childCount < 10) c += 'small';
        else if (childCount < 50) c += 'medium';
        else c += 'large';

        return new L.DivIcon({
            html: '<div></div>',
            className: 'marker-cluster' + c,
            iconSize: new L.Point(40, 40)
        });
    }
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

    L.geoJSON(municipiosData, {
        style: { color: '#999', weight: 1, fillColor: '#3388ff', fillOpacity: 0.1 },
        onEachFeature: function(feature, layer) {
             if(feature.properties && feature.properties.nm_mun) {
                 layer.bindTooltip(feature.properties.nm_mun);
             }
        }
    }).addTo(map);

    window.dadosGlobais = {
        pontos: pontosDataLocal,
        linhas: linhasDataLocal,
        municipios: municipiosData
    };

    window.linhasLayer.addData(linhasDataLocal);

    const pontosGeoJSON = L.geoJSON(pontosDataLocal, {
        pointToLayer: function (feature, latlng) {
            return L.marker(latlng, { icon: obterIcone(feature) });
        },
        onEachFeature: onEachFeatureGeral
    });
    window.clusterPontos.addLayer(pontosGeoJSON);

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
    if (!window.parent || !window.parent.document) return;

    preencherSelect('filtro-municipio', listaMunicipios);
    preencherSelect('filtro-territorio', listaTerritorios);

    if (!window.dadosGlobais) return;
    
    const todosDados = [];
    if (window.dadosGlobais.pontos) todosDados.push(...window.dadosGlobais.pontos.features);
    if (window.dadosGlobais.linhas) todosDados.push(...window.dadosGlobais.linhas.features);

    const orgaos = getUniqueValues(todosDados, 'Orgão da Açao');
    const situacoes = getUniqueValues(todosDados, 'Status_atual');
    const eixos = getUniqueValues(todosDados, 'Eixo');
    const tipologias = getUniqueValues(todosDados, 'TIPOLOGIA');
    const recebimentos = getUniqueValues(todosDados, 'RECEBIMENTO');
    const idsAcao = getUniqueValues(todosDados, 'project_id'); // Novo: IDs de ação

    // Extrai Anos da data de celebração
    const anosCelebracao = new Set();
    todosDados.forEach(f => {
        const val = f.properties['data_celebracao'];
        if(val && val.length >= 4) {
            anosCelebracao.add(val.substring(0, 4));
        }
    });
    const listaAnos = Array.from(anosCelebracao).sort().reverse();

    preencherSelect('filtro-orgao', orgaos);
    preencherSelect('filtro-situacao', situacoes);
    preencherSelect('filtro-eixo', eixos);
    preencherSelect('filtro-tipologia', tipologias);
    preencherSelect('filtro-ano', listaAnos);
    preencherSelect('filtro-recebimento', recebimentos);
    preencherSelect('filtro-id-acao', idsAcao); // Preenche o select do ID da ação

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
        tipologia: getSelectedValues('filtro-tipologia'),
        ano: getSelectedValues('filtro-ano'),
        recebimento: getSelectedValues('filtro-recebimento'),
        idAcao: getSelectedValues('filtro-id-acao') // Novo filtro capturado
    };

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
    const tipoDados = getVal('TIPOLOGIA');
    
    const dataCelebracao = getVal('data_celebracao');
    const anoCelebracao = dataCelebracao.length >= 4 ? dataCelebracao.substring(0, 4) : "";
    const recebimentoDados = getVal('RECEBIMENTO');
    const idAcaoDados = getVal('project_id'); // Novo dado para comparar

    // Filtros
    if (filtros.municipio.length > 0) {
        const match = filtros.municipio.some(filtro => munDados.includes(filtro.toUpperCase()));
        if (!match) return false;
    }
    if (filtros.territorio.length > 0) {
        const match = filtros.territorio.some(filtro => terrDados.includes(filtro.toUpperCase()));
        if (!match) return false;
    }
    if (filtros.orgao.length > 0 && !filtros.orgao.includes(orgaoDados)) return false;
    if (filtros.situacao.length > 0 && !filtros.situacao.includes(sitDados)) return false;
    if (filtros.eixo.length > 0 && !filtros.eixo.includes(eixoDados)) return false;
    if (filtros.tipologia.length > 0 && !filtros.tipologia.includes(tipoDados)) return false;
    if (filtros.ano.length > 0 && !filtros.ano.includes(anoCelebracao)) return false;
    if (filtros.recebimento.length > 0 && !filtros.recebimento.includes(recebimentoDados)) return false;
    if (filtros.idAcao.length > 0 && !filtros.idAcao.includes(idAcaoDados)) return false; // Novo filtro aplicado

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