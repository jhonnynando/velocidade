const state = {
  config: {
    minAnalysisSpeed: 50,
    speedLimit: 80,
  },
  defaults: {
    minAnalysisSpeed: 50,
    speedLimit: 80,
  },
  charts: {},
  payload: null,
  records: [],
};

const dom = {};

document.addEventListener("DOMContentLoaded", () => {
  initializeDashboard().catch((error) => {
    console.error(error);
    renderFatalError(error);
  });
});

async function initializeDashboard() {
  cacheDom();
  bindEvents();
  setLoadingState();

  state.payload = await loadDashboardData();
  state.records = prepareRecords(state.payload.records || []);
  state.defaults = {
    minAnalysisSpeed: toPositiveNumber(
      state.payload.config?.defaultMinAnalysisSpeed,
      50,
    ),
    speedLimit: toPositiveNumber(
      state.payload.config?.defaultSpeedLimit,
      80,
    ),
  };

  state.config = { ...state.defaults };
  populateFilterOptions();
  updateHeaderMeta();
  renderDashboard();
}

function cacheDom() {
  dom.generatedAt = document.querySelector("#generatedAt");
  dom.sourceFiles = document.querySelector("#sourceFiles");
  dom.activeRules = document.querySelector("#activeRules");
  dom.resultsSummary = document.querySelector("#resultsSummary");

  dom.clearFiltersButton = document.querySelector("#clearFiltersButton");

  dom.plateFilter = document.querySelector("#plateFilter");
  dom.vehicleFilter = document.querySelector("#vehicleFilter");
  dom.severityFilter = document.querySelector("#severityFilter");
  dom.startDateFilter = document.querySelector("#startDateFilter");
  dom.endDateFilter = document.querySelector("#endDateFilter");
  dom.searchFilter = document.querySelector("#searchFilter");
  dom.severityChartNote = document.querySelector("#severityChartNote");
  dom.topSpeedByHourNote = document.querySelector("#topSpeedByHourNote");

  dom.totalRecordsCard = document.querySelector("#totalRecordsCard");
  dom.topSpeedCard = document.querySelector("#topSpeedCard");
  dom.topSpeedNote = document.querySelector("#topSpeedNote");
  dom.averageSpeedCard = document.querySelector("#averageSpeedCard");
  dom.averageExcessCard = document.querySelector("#averageExcessCard");
  dom.monitoredPlatesCard = document.querySelector("#monitoredPlatesCard");

  dom.plateRanking = document.querySelector("#plateRanking");
  dom.maxSpeedRanking = document.querySelector("#maxSpeedRanking");
  dom.vehicleRanking = document.querySelector("#vehicleRanking");

}

function bindEvents() {
  dom.clearFiltersButton.addEventListener("click", () => {
    dom.plateFilter.value = "";
    dom.vehicleFilter.value = "";
    dom.severityFilter.value = "";
    dom.startDateFilter.value = "";
    dom.endDateFilter.value = "";
    dom.searchFilter.value = "";
    renderDashboard();
  });

  [dom.plateFilter, dom.vehicleFilter, dom.severityFilter].forEach((element) => {
    element.addEventListener("change", () => renderDashboard());
  });

  [dom.startDateFilter, dom.endDateFilter, dom.searchFilter].forEach((element) => {
    element.addEventListener("input", () => renderDashboard());
  });
}

async function loadDashboardData() {
  if (window.location.protocol !== "file:") {
    try {
      const response = await fetch("data/dashboard-data.json", { cache: "no-store" });

      if (!response.ok) {
        throw new Error(`Falha ao buscar data/dashboard-data.json (${response.status})`);
      }

      return response.json();
    } catch (error) {
      console.warn("Falha ao carregar JSON. Tentando fallback local em JavaScript.", error);
    }
  }

  if (window.FLEET_SPEED_DASHBOARD_DATA) {
    return window.FLEET_SPEED_DASHBOARD_DATA;
  }

  throw new Error(
    "Nenhum arquivo de dados foi encontrado. Gere data/dashboard-data.json e data/dashboard-data.js antes de abrir o dashboard.",
  );
}

function prepareRecords(records) {
  return records.map((record) => {
    const vehicle = safeText(record.vehicle, "");
    const driverDisplay = vehicle || "-";
    const plate = safeText(record.plate, "Nao informado");
    const event = safeText(record.event, "Sem evento");
    const address = safeText(record.address, "Endereco nao informado");
    const displayDateTime = safeText(record.displayDateTime, "Data invalida");
    const speed = Number.isFinite(record.speed) ? record.speed : null;
    const dateKey = safeText(record.dateKey, "");
    const timestampSortable = safeText(record.timestampSortable || record.timestamp, "");
    const validationIssues = Array.isArray(record.validationIssues) ? record.validationIssues : [];

    return {
      ...record,
      vehicle,
      driverDisplay,
      plate,
      event,
      address,
      displayDateTime,
      speed,
      dateKey,
      timestampSortable,
      validationIssues,
      isValidRecord:
        record.isValidRecord !== false &&
        Boolean(dateKey) &&
        Number.isFinite(speed),
      searchIndex: normalizeText(
        `${vehicle} ${plate} ${event} ${address} ${displayDateTime}`,
      ),
    };
  });
}

function populateFilterOptions() {
  populateSelect(dom.plateFilter, uniqueSortedValues(state.records.map((record) => record.plate)));
  populateSelect(dom.vehicleFilter, uniqueSortedValues(state.records.map((record) => record.vehicle)));
}

function populateSelect(selectElement, values) {
  const firstOption = selectElement.querySelector("option");
  selectElement.innerHTML = "";
  selectElement.appendChild(firstOption);

  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    selectElement.appendChild(option);
  });
}

function renderDashboard() {
  const recordsWithRules = state.records.map((record) => applyRules(record, state.config.speedLimit));
  const filteredRecords = applyFilters(recordsWithRules);
  const validRecords = filteredRecords.filter((record) => record.isValidRecord);
  const alertRecords = validRecords.filter((record) => record.isAlert);
  const analysisRecords = getAnalysisRecords(validRecords);

  updateHeaderMeta(filteredRecords, analysisRecords, alertRecords);
  renderStatCards(filteredRecords, validRecords, analysisRecords, alertRecords);
  renderCharts(analysisRecords, alertRecords);
  renderRankings(analysisRecords, alertRecords);
}

function applyRules(record, speedLimit) {
  const effectiveSpeedLimit = Number.isFinite(record.roadSpeedLimit)
    ? record.roadSpeedLimit
    : speedLimit;
  const severity = Number.isFinite(record.roadSpeedLimit) && record.severityDefault
    ? record.severityDefault
    : classifySeverity(record.speed, effectiveSpeedLimit, record.isValidRecord);

  return {
    ...record,
    severity,
    effectiveSpeedLimit,
    isAlert: record.isValidRecord && record.speed > effectiveSpeedLimit,
  };
}

function applyFilters(records) {
  const plate = dom.plateFilter.value;
  const vehicle = dom.vehicleFilter.value;
  const severity = dom.severityFilter.value;
  const startDate = dom.startDateFilter.value;
  const endDate = dom.endDateFilter.value;
  const searchTerm = normalizeText(dom.searchFilter.value.trim());

  return records.filter((record) => {
    if (plate && record.plate !== plate) {
      return false;
    }

    if (vehicle && record.vehicle !== vehicle) {
      return false;
    }

    if (severity && record.severity !== severity) {
      return false;
    }

    if (startDate && (!record.dateKey || record.dateKey < startDate)) {
      return false;
    }

    if (endDate && (!record.dateKey || record.dateKey > endDate)) {
      return false;
    }

    if (searchTerm && !record.searchIndex.includes(searchTerm)) {
      return false;
    }

    return true;
  });
}

function renderStatCards(filteredRecords, validRecords, analysisRecords, alertRecords) {
  const topSpeed = validRecords.reduce((maxValue, record) => {
    return Math.max(maxValue, record.speed);
  }, 0);
  const topSpeedPlates = validRecords.length
    ? [...new Set(
      validRecords
        .filter((record) => record.speed === topSpeed)
        .map((record) => record.plate || "Nao informado"),
    )]
    : [];
  const averageSpeed = analysisRecords.length
    ? analysisRecords.reduce((sum, record) => sum + record.speed, 0) / analysisRecords.length
    : null;
  const averageExcess = alertRecords.length
    ? alertRecords.reduce((sum, record) => sum + Math.max(record.speed - record.effectiveSpeedLimit, 0), 0) / alertRecords.length
    : null;

  const monitoredPlates = new Set(
    filteredRecords
      .map((record) => record.plate)
      .filter((plate) => plate && plate !== "Nao informado"),
  ).size;

  dom.totalRecordsCard.textContent = formatNumber(filteredRecords.length);
  dom.topSpeedCard.textContent = validRecords.length ? `${formatSpeed(topSpeed)} km/h` : "--";
  dom.topSpeedNote.textContent = describeTopSpeedPlates(topSpeedPlates);
  dom.averageSpeedCard.textContent = averageSpeed === null ? "--" : `${formatSpeed(averageSpeed)} km/h`;
  dom.averageExcessCard.textContent = averageExcess === null ? "--" : `${formatSpeed(averageExcess)} km/h`;
  dom.monitoredPlatesCard.textContent = formatNumber(monitoredPlates);
}

function renderCharts(analysisRecords, alertRecords) {
  dom.severityChartNote.textContent = usesPerEventSpeedLimit()
    ? "Considera o limite da via de cada evento."
    : `Considera velocidades a partir de ${formatSpeed(state.config.minAnalysisSpeed)} km/h.`;
  dom.topSpeedByHourNote.textContent = "Passe o mouse na linha para ver a velocidade.";

  const plateAlertRows = topCounts(alertRecords, (record) => record.plate, 7);
  const vehicleAlertRows = topCounts(alertRecords, (record) => record.vehicle, 7);

  const severityRows = [
    { label: "Normal", value: analysisRecords.filter((record) => record.severity === "Normal").length },
    { label: "Atencao", value: analysisRecords.filter((record) => record.severity === "Atencao").length },
    { label: "Critico", value: analysisRecords.filter((record) => record.severity === "Critico").length },
  ].filter((row) => row.value > 0);

  const alertsByDayRows = countsByDay(alertRecords, 10);
  const topSpeedByHourRows = maximumsByHour(analysisRecords);

  renderHorizontalBarChart(
    "plateAlertsChart",
    plateAlertRows,
    "Alertas",
    "rgba(15, 91, 99, 0.82)",
  );
  renderHorizontalBarChart(
    "vehicleAlertsChart",
    vehicleAlertRows,
    "Alertas",
    "rgba(201, 122, 43, 0.82)",
  );
  renderDoughnutChart("severityChart", severityRows);
  renderLineChart("alertsByDayChart", alertsByDayRows);
  renderLineChart(
    "topSpeedByHourChart",
    topSpeedByHourRows,
    {
      datasetLabel: "Maior velocidade",
      emptyMessage: getAnalysisEmptyMessage(),
      borderColor: "rgba(15, 91, 99, 0.92)",
      backgroundColor: "rgba(15, 91, 99, 0.14)",
      tooltipLabelFormatter: (value) => `${formatSpeed(value)} km/h`,
      hoverValueTarget: dom.topSpeedByHourNote,
      hoverPlaceholder: "Passe o mouse na linha para ver a velocidade.",
      hoverLabelFormatter: (row) => `${row.label} | ${formatSpeed(row.value)} km/h`,
    },
  );
}

function renderRankings(analysisRecords, alertRecords) {
  const plateRanking = topCounts(alertRecords, (record) => record.plate, 5);
  const maxSpeedRanking = topMaximums(analysisRecords, (record) => record.vehicle, (record) => record.speed, 5);
  const vehicleRanking = topCounts(alertRecords, (record) => record.vehicle, 5);

  renderRankingList(dom.plateRanking, plateRanking, "alertas");
  renderRankingList(dom.maxSpeedRanking, maxSpeedRanking, "km/h");
  renderRankingList(dom.vehicleRanking, vehicleRanking, "alertas");
}

function updateHeaderMeta(filteredRecords = null, analysisRecords = null, alertRecords = null) {
  const payload = state.payload || {};
  const sourceFiles = Array.isArray(payload.sourceFiles) ? payload.sourceFiles : [];
  const generatedAt = payload.generatedAt
    ? formatGeneratedAt(payload.generatedAt)
    : "Nao informado";

  dom.generatedAt.textContent = generatedAt;
  dom.sourceFiles.textContent = sourceFiles.length
    ? sourceFiles.join(", ")
    : "Sem origem informada";
  dom.activeRules.textContent = usesPerEventSpeedLimit()
    ? "Analise baseada no limite da via de cada evento"
    : `Minimo ${formatSpeed(state.config.minAnalysisSpeed)} km/h | Limite ${formatSpeed(state.config.speedLimit)} km/h`;

  if (!filteredRecords || !analysisRecords || !alertRecords) {
    dom.resultsSummary.textContent = "Carregando...";
    return;
  }

  dom.resultsSummary.textContent =
    `${formatNumber(filteredRecords.length)} registros | ` +
    `${formatNumber(analysisRecords.length)} na analise | ` +
    `${formatNumber(alertRecords.length)} alertas`;
}

function renderHorizontalBarChart(elementId, rows, datasetLabel, color) {
  const canvas = document.getElementById(elementId);

  if (!rows.length || !window.Chart) {
    setChartEmptyState(canvas, !window.Chart ? "Chart.js nao foi carregado." : "Sem dados para o grafico atual.");
    destroyChart(elementId);
    return;
  }

  setChartEmptyState(canvas, "");
  destroyChart(elementId);

  state.charts[elementId] = new Chart(canvas, {
    type: "bar",
    data: {
      labels: rows.map((row) => row.label),
      datasets: [
        {
          label: datasetLabel,
          data: rows.map((row) => row.value),
          borderRadius: 12,
          backgroundColor: color,
          borderSkipped: false,
        },
      ],
    },
    options: {
      maintainAspectRatio: false,
      indexAxis: "y",
      plugins: {
        legend: { display: false },
      },
      scales: {
        x: {
          beginAtZero: true,
          ticks: {
            precision: 0,
            color: "#5a6673",
          },
          grid: {
            color: "rgba(22, 32, 43, 0.08)",
          },
        },
        y: {
          ticks: {
            color: "#16202b",
          },
          grid: {
            display: false,
          },
        },
      },
    },
  });
}

function renderDoughnutChart(elementId, rows) {
  const canvas = document.getElementById(elementId);
  const hasValues = rows.some((row) => row.value > 0);
  const colorMap = {
    Normal: "rgba(47, 125, 76, 0.82)",
    Atencao: "rgba(208, 141, 47, 0.82)",
    Critico: "rgba(183, 76, 67, 0.82)",
  };

  if (!hasValues || !window.Chart) {
    setChartEmptyState(
      canvas,
      !window.Chart
        ? "Chart.js nao foi carregado."
        : getAnalysisEmptyMessage(),
    );
    destroyChart(elementId);
    return;
  }

  setChartEmptyState(canvas, "");
  destroyChart(elementId);

  const labelsWithValues = rows.map((row) => `${row.label} (${formatNumber(row.value)})`);

  state.charts[elementId] = new Chart(canvas, {
    type: "doughnut",
    data: {
      labels: labelsWithValues,
      datasets: [
        {
          data: rows.map((row) => row.value),
          backgroundColor: rows.map((row) => colorMap[row.label] || "rgba(90, 102, 115, 0.82)"),
          borderColor: "#fbfaf6",
          borderWidth: 4,
        },
      ],
    },
    options: {
      maintainAspectRatio: false,
      cutout: "62%",
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            color: "#16202b",
            boxWidth: 12,
            usePointStyle: true,
          },
        },
        tooltip: {
          callbacks: {
            label(context) {
              return String(context.label || "");
            },
          },
        },
      },
    },
  });
}

function renderLineChart(elementId, rows, options = {}) {
  const canvas = document.getElementById(elementId);
  const datasetLabel = options.datasetLabel || "Alertas por dia";
  const emptyMessage = options.emptyMessage || "Nenhum alerta encontrado no periodo atual.";
  const borderColor = options.borderColor || "rgba(183, 76, 67, 0.92)";
  const backgroundColor = options.backgroundColor || "rgba(183, 76, 67, 0.14)";
  const tooltipLabelFormatter = options.tooltipLabelFormatter || ((value) => formatNumber(value));
  const hoverValueTarget = options.hoverValueTarget || null;
  const hoverPlaceholder = options.hoverPlaceholder || "";
  const hoverLabelFormatter = options.hoverLabelFormatter || ((row) => `${row.label}: ${tooltipLabelFormatter(row.value)}`);
  const hasValues = rows.some((row) => Number.isFinite(row.value));

  if (!hasValues || !window.Chart) {
    setChartEmptyState(canvas, !window.Chart ? "Chart.js nao foi carregado." : emptyMessage);
    destroyChart(elementId);
    if (hoverValueTarget) {
      hoverValueTarget.textContent = emptyMessage;
    }
    return;
  }

  setChartEmptyState(canvas, "");
  destroyChart(elementId);

  const chart = new Chart(canvas, {
    type: "line",
    data: {
      labels: rows.map((row) => row.label),
      datasets: [
        {
          label: datasetLabel,
          data: rows.map((row) => row.value),
          tension: 0.28,
          fill: true,
          borderColor,
          backgroundColor,
          pointRadius: 4,
          pointHoverRadius: 7,
          pointHitRadius: 28,
          spanGaps: false,
        },
      ],
    },
    options: {
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label(context) {
              if (!Number.isFinite(context.parsed.y)) {
                return `${datasetLabel}: sem dado`;
              }

              return `${datasetLabel}: ${tooltipLabelFormatter(context.parsed.y)}`;
            },
          },
        },
      },
      interaction: {
        mode: "index",
        axis: "x",
        intersect: false,
      },
      scales: {
        x: {
          ticks: {
            color: "#5a6673",
          },
          grid: {
            display: false,
          },
        },
        y: {
          beginAtZero: true,
          ticks: {
            precision: 0,
            color: "#5a6673",
          },
          grid: {
            color: "rgba(22, 32, 43, 0.08)",
          },
        },
      },
    },
  });

  state.charts[elementId] = chart;
  bindLineChartHover(canvas, chart, rows, hoverValueTarget, hoverPlaceholder, hoverLabelFormatter);
}

function renderRankingList(element, rows, suffix) {
  if (!rows.length) {
    element.innerHTML = '<li class="ranking-item">Nenhum dado para o ranking atual.</li>';
    return;
  }

  const topValue = rows[0].value || 1;

  element.innerHTML = rows
    .map((row) => {
      const fill = `${Math.max((row.value / topValue) * 100, 6)}%`;

      return `
        <li class="ranking-item" style="--fill: ${fill}">
          <div class="ranking-item-header">
            <strong>${escapeHtml(row.label)}</strong>
            <span class="ranking-metric">${escapeHtml(String(row.value))} ${escapeHtml(suffix)}</span>
          </div>
          <div class="ranking-meter"></div>
        </li>
      `;
    })
    .join("");
}

function setChartEmptyState(canvas, message) {
  const emptyState = canvas.parentElement.querySelector(".chart-empty");

  if (!message) {
    emptyState.hidden = true;
    canvas.hidden = false;
    return;
  }

  emptyState.hidden = false;
  emptyState.textContent = message;
  canvas.hidden = true;
}

function destroyChart(elementId) {
  const canvas = document.getElementById(elementId);

  if (canvas) {
    canvas.onmousemove = null;
    canvas.onmouseleave = null;
    canvas.style.cursor = "default";
  }

  if (state.charts[elementId]) {
    state.charts[elementId].destroy();
    delete state.charts[elementId];
  }
}

function bindLineChartHover(canvas, chart, rows, hoverValueTarget, hoverPlaceholder, hoverLabelFormatter) {
  canvas.onmousemove = (event) => {
    const elements = chart.getElementsAtEventForMode(
      event,
      "nearest",
      { axis: "x", intersect: false },
      false,
    );

    canvas.style.cursor = elements.length ? "pointer" : "default";

    if (!elements.length) {
      chart.setActiveElements([]);
      chart.tooltip.setActiveElements([], { x: 0, y: 0 });
      chart.update("none");

      if (hoverValueTarget) {
        hoverValueTarget.textContent = hoverPlaceholder;
      }

      return;
    }

    const activeElements = elements.map((element) => ({
      datasetIndex: element.datasetIndex,
      index: element.index,
    }));
    const row = rows[elements[0].index];

    chart.setActiveElements(activeElements);
    chart.tooltip.setActiveElements(activeElements, {
      x: event.offsetX,
      y: event.offsetY,
    });
    chart.update("none");

    if (!hoverValueTarget || !row || !Number.isFinite(row.value)) {
      return;
    }

    hoverValueTarget.textContent = hoverLabelFormatter(row, chart);
  };

  canvas.onmouseleave = () => {
    canvas.style.cursor = "default";
    chart.setActiveElements([]);
    chart.tooltip.setActiveElements([], { x: 0, y: 0 });
    chart.update("none");

    if (hoverValueTarget) {
      hoverValueTarget.textContent = hoverPlaceholder;
    }
  };
}

function topCounts(records, keySelector, limit) {
  const counter = new Map();

  records.forEach((record) => {
    const label = safeText(keySelector(record), "");
    if (!label) {
      return;
    }

    counter.set(label, (counter.get(label) || 0) + 1);
  });

  return [...counter.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((left, right) => right.value - left.value || left.label.localeCompare(right.label, "pt-BR"))
    .slice(0, limit);
}

function topMaximums(records, keySelector, valueSelector, limit) {
  const maximums = new Map();

  records.forEach((record) => {
    const label = safeText(keySelector(record), "");
    if (!label) {
      return;
    }

    const currentValue = maximums.get(label) || 0;
    maximums.set(label, Math.max(currentValue, valueSelector(record)));
  });

  return [...maximums.entries()]
    .map(([label, value]) => ({ label, value: Number(formatSpeed(value).replace(",", ".")) }))
    .sort((left, right) => right.value - left.value || left.label.localeCompare(right.label, "pt-BR"))
    .slice(0, limit);
}

function countsByDay(records, limit) {
  const counts = new Map();

  records.forEach((record) => {
    counts.set(record.dateKey, (counts.get(record.dateKey) || 0) + 1);
  });

  return [...counts.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .slice(-limit)
    .map(([dateKey, value]) => ({
      label: formatDateKey(dateKey),
      value,
    }));
}

function maximumsByHour(records) {
  const maximums = new Map();

  records.forEach((record) => {
    if (!record.timestampSortable || !Number.isFinite(record.speed)) {
      return;
    }

    const hourKey = record.timestampSortable.slice(11, 13);
    const currentMax = maximums.get(hourKey);

    if (!Number.isFinite(currentMax) || record.speed > currentMax) {
      maximums.set(hourKey, record.speed);
    }
  });

  return Array.from({ length: 24 }, (_, hour) => {
    const hourKey = String(hour).padStart(2, "0");

    return {
      label: `${hourKey}h`,
      value: maximums.has(hourKey) ? maximums.get(hourKey) : null,
    };
  });
}

function classifySeverity(speed, speedLimit, isValidRecord) {
  if (!isValidRecord || !Number.isFinite(speed)) {
    return "Dados invalidos";
  }

  if (speed <= speedLimit) {
    return "Normal";
  }

  if (speed <= speedLimit + 10) {
    return "Atencao";
  }

  return "Critico";
}

function uniqueSortedValues(values) {
  return [...new Set(values.filter(Boolean))]
    .sort((left, right) => left.localeCompare(right, "pt-BR", { numeric: true }));
}

function usesPerEventSpeedLimit() {
  return Boolean(state.payload?.config?.usesPerEventSpeedLimit);
}

function getAnalysisRecords(validRecords) {
  return usesPerEventSpeedLimit()
    ? validRecords
    : validRecords.filter((record) => record.speed >= state.config.minAnalysisSpeed);
}

function getAnalysisEmptyMessage() {
  return usesPerEventSpeedLimit()
    ? "Sem eventos validos no periodo atual."
    : `Sem registros a partir de ${formatSpeed(state.config.minAnalysisSpeed)} km/h.`;
}

function setLoadingState() {
  dom.generatedAt.textContent = "Carregando...";
  dom.sourceFiles.textContent = "Carregando...";
  dom.activeRules.textContent = "Carregando...";
  dom.resultsSummary.textContent = "Carregando...";
}

function renderFatalError(error) {
  const message = escapeHtml(error.message || "Falha ao carregar o dashboard.");

  if (dom.generatedAt) {
    dom.generatedAt.textContent = "Falha";
    dom.sourceFiles.textContent = "Falha";
    dom.activeRules.textContent = "Falha";
    dom.resultsSummary.textContent = message || "Verifique os arquivos em /data";
  }
}

function safeText(value, fallback = "") {
  if (value === null || value === undefined) {
    return fallback;
  }

  const text = String(value).trim();
  return text || fallback;
}

function toPositiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function normalizeText(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function formatNumber(value) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

function formatSpeed(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(".", ",");
}



function describeTopSpeedPlates(plates) {
  if (!plates.length) {
    return "Sem registros validos na visao atual.";
  }

  if (plates.length === 1) {
    return `Placa com esse pico: ${plates[0]}.`;
  }

  return `Placas com esse pico: ${plates.join(", ")}.`;
}

function formatDateKey(dateKey) {
  if (!dateKey) {
    return "-";
  }

  const [year, month, day] = dateKey.split("-");
  return `${day}/${month}`;
}

function formatGeneratedAt(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(date);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
