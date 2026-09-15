let attachedFiles = [];
let attachedImages = [];
let conversationHistory = []; // Multi-turn history tracking

// Configure PDF.js Worker
if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

document.addEventListener('DOMContentLoaded', () => {
    const sendBtn = document.getElementById('send-btn');
    const userInput = document.getElementById('user-input');
    const fileInput = document.getElementById('file-input');
    const chatContainer = document.getElementById('chat-messages');

    // Theme & Sidebar Controls
    const themeToggleBtn = document.getElementById('theme-toggle') || document.querySelector('.btn-secondary');
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            document.body.classList.toggle('dark-mode');
            const isDark = document.body.classList.contains('dark-mode');
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
        });

        if (localStorage.getItem('theme') === 'dark') {
            document.body.classList.add('dark-mode');
        }
    }

    const menuToggleBtn = document.getElementById('menu-toggle');
    const sidebar = document.querySelector('.sidebar');
    if (menuToggleBtn && sidebar) {
        menuToggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('active');
        });
    }

    if (sendBtn) sendBtn.addEventListener('click', sendMessage);
    if (userInput) {
        userInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });
        
        userInput.addEventListener('paste', (e) => {
            const items = (e.clipboardData || e.originalEvent.clipboardData).items;
            for (let item of items) {
                if (item.type.indexOf('image') !== -1) {
                    const blob = item.getAsFile();
                    handleFileUpload(blob);
                }
            }
        });
    }

    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            Array.from(e.target.files).forEach(handleFileUpload);
            fileInput.value = '';
        });
    }

    // Drag and Drop Zone Event Listeners
    const dropZone = chatContainer || document.body;

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
        }, false);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.style.border = '2px dashed #6c5ce7';
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.style.border = 'none';
        }, false);
    });

    dropZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files && files.length > 0) {
            Array.from(files).forEach(handleFileUpload);
        }
    }, false);
});

// MULTI-FILE PARSING ENGINE
function handleFileUpload(file) {
    if (!file) return;
    const extension = file.name.split('.').pop().toLowerCase();

    if (file.type.startsWith('image/')) {
        processImageFile(file);
    } else if (extension === 'csv') {
        processCSVFile(file);
    } else if (extension === 'xlsx' || extension === 'xls') {
        processExcelFile(file);
    } else if (extension === 'pdf') {
        processPDFFile(file);
    } else {
        processTextFile(file);
    }
}

function processImageFile(file) {
    const reader = new FileReader();
    reader.onload = function (e) {
        const base64Data = e.target.result.split(',')[1];
        attachedImages.push(base64Data);
        renderPreviews();
    };
    reader.readAsDataURL(file);
}

function processCSVFile(file) {
    if (typeof Papa === 'undefined') {
        processTextFile(file);
        return;
    }
    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: function (results) {
            const summary = `CSV Summary [${file.name}] (${results.data.length} rows):\nHeaders: ${results.meta.fields.join(', ')}\nSample Data:\n` + 
                            JSON.stringify(results.data.slice(0, 15), null, 2);
            
            attachedFiles.push({
                name: file.name,
                content: summary.substring(0, 8000)
            });
            renderPreviews();
        }
    });
}

function processExcelFile(file) {
    if (typeof XLSX === 'undefined') {
        processTextFile(file);
        return;
    }
    const reader = new FileReader();
    reader.onload = function (e) {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        
        let extractedText = `Excel Workbook [${file.name}]\nSheets: ${workbook.SheetNames.join(', ')}\n\n`;

        workbook.SheetNames.forEach(sheetName => {
            const sheet = workbook.Sheets[sheetName];
            const jsonSheet = XLSX.utils.sheet_to_json(sheet, { header: 1 });
            extractedText += `--- Sheet: ${sheetName} (${jsonSheet.length} rows) ---\n`;
            extractedText += JSON.stringify(jsonSheet.slice(0, 10)) + '\n\n';
        });

        attachedFiles.push({
            name: file.name,
            content: extractedText.substring(0, 8000)
        });
        renderPreviews();
    };
    reader.readAsArrayBuffer(file);
}

function processPDFFile(file) {
    if (typeof pdfjsLib === 'undefined') {
        processTextFile(file);
        return;
    }
    const reader = new FileReader();
    reader.onload = function (e) {
        const typedarray = new Uint8Array(e.target.result);
        
        pdfjsLib.getDocument(typedarray).promise.then(async (pdf) => {
            let fullText = `PDF Document [${file.name}] (${pdf.numPages} pages)\n\n`;
            
            const maxPages = Math.min(pdf.numPages, 5);
            for (let i = 1; i <= maxPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map(item => item.str).join(' ');
                fullText += `--- Page ${i} ---\n${pageText}\n\n`;
            }

            attachedFiles.push({
                name: file.name,
                content: fullText.substring(0, 8000)
            });
            renderPreviews();
        });
    };
    reader.readAsArrayBuffer(file);
}

function processTextFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
        attachedFiles.push({
            name: file.name || "attached_doc.txt",
            content: e.target.result.substring(0, 8000)
        });
        renderPreviews();
    };
    reader.readAsText(file);
}

function removeFile(index) {
    attachedFiles.splice(index, 1);
    renderPreviews();
}

function removeImage(index) {
    attachedImages.splice(index, 1);
    renderPreviews();
}

function renderPreviews() {
    const container = document.getElementById('preview-container');
    if (!container) return;
    container.innerHTML = '';

    attachedFiles.forEach((f, idx) => {
        const pill = document.createElement('span');
        pill.style.cssText = 'background: #6c5ce7; color: white; padding: 4px 10px; border-radius: 12px; font-size: 0.8rem; display: inline-flex; align-items: center; gap: 6px;';
        pill.innerHTML = `
            <span>📄 ${f.name}</span>
            <span onclick="removeFile(${idx})" style="cursor: pointer; font-weight: bold; background: rgba(0,0,0,0.2); border-radius: 50%; padding: 0 5px; line-height: 1.2;">&times;</span>
        `;
        container.appendChild(pill);
    });

    attachedImages.forEach((img, idx) => {
        const pill = document.createElement('span');
        pill.style.cssText = 'background: #00b894; color: white; padding: 4px 10px; border-radius: 12px; font-size: 0.8rem; display: inline-flex; align-items: center; gap: 6px;';
        pill.innerHTML = `
            <span>🖼️ Image ${idx + 1}</span>
            <span onclick="removeImage(${idx})" style="cursor: pointer; font-weight: bold; background: rgba(0,0,0,0.2); border-radius: 50%; padding: 0 5px; line-height: 1.2;">&times;</span>
        `;
        container.appendChild(pill);
    });
}

// EXPORT SERVICE (MULTI-CHART & MERMAID SVG CAPTURE)
async function downloadReport(fileType, title, insightsText, container) {
    const insightsArray = insightsText.split('\n').filter(line => line.trim().length > 0);
    
    let chartImages = [];
    let tableDataList = [];

    if (container) {
        // 1. Capture Canvas Charts
        const canvases = container.querySelectorAll('canvas');
        canvases.forEach(canvas => {
            try {
                chartImages.push(canvas.toDataURL('image/png'));
            } catch (e) {
                console.error("Failed to extract canvas image:", e);
            }
        });

        // 2. Capture Mermaid SVG Diagrams as Base64 Images
        const svgElements = container.querySelectorAll('.diagram-wrapper svg');
        for (let svg of svgElements) {
            try {
                const svgData = new XMLSerializer().serializeToString(svg);
                const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
                const url = URL.createObjectURL(svgBlob);
                
                const img = new Image();
                await new Promise((resolve) => {
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        const bbox = svg.getBBox ? svg.getBBox() : { width: 800, height: 400 };
                        canvas.width = Math.max(bbox.width + 40, 800);
                        canvas.height = Math.max(bbox.height + 40, 400);
                        
                        const ctx = canvas.getContext('2d');
                        ctx.fillStyle = "#1e1e2e"; // Dark slate background matching PPT theme
                        ctx.fillRect(0, 0, canvas.width, canvas.height);
                        ctx.drawImage(img, 20, 20);
                        
                        chartImages.push(canvas.toDataURL('image/png'));
                        URL.revokeObjectURL(url);
                        resolve();
                    };
                    img.onerror = () => {
                        URL.revokeObjectURL(url);
                        resolve();
                    };
                    img.src = url;
                });
            } catch (err) {
                console.error("Failed to convert SVG diagram to image:", err);
            }
        }

        // 3. Extract Rendered Tables
        const tables = container.querySelectorAll('table');
        tables.forEach((table, idx) => {
            const headers = Array.from(table.querySelectorAll('th')).map(th => th.innerText.trim());
            const rows = Array.from(table.querySelectorAll('tbody tr')).map(tr => {
                return Array.from(tr.querySelectorAll('td')).map(td => td.innerText.trim());
            });
            const tableTitleHeader = table.closest('.table-container')?.querySelector('h4')?.innerText;

            tableDataList.push({
                title: tableTitleHeader || `Summary Table ${idx + 1}`,
                headers: headers,
                rows: rows
            });
        });
    }

    try {
        const response = await fetch('/api/export', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                file_type: fileType,
                title: title || 'Sasha AI Executive Report',
                insights: insightsArray,
                table_data_list: tableDataList,
                table_data: tableDataList.length > 0 ? tableDataList[0] : null,
                chart_images_b64: chartImages,
                chart_image_b64: chartImages.length > 0 ? chartImages[0] : null
            })
        });

        if (!response.ok) throw new Error("Export failed");

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        const ext = fileType === 'word' ? 'docx' : fileType === 'powerpoint' ? 'pptx' : fileType === 'excel' ? 'xlsx' : 'pdf';
        
        a.href = url;
        a.download = `Sasha_Executive_Report.${ext}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
    } catch (err) {
        console.error("Failed to generate multi-chart export file:", err);
    }
}

function renderExportToolbar(container, title, textContent) {
    const toolbar = document.createElement('div');
    toolbar.style.cssText = 'margin-top: 14px; padding-top: 8px; border-top: 1px solid var(--border-color, #e2e8f0); display: flex; gap: 8px; flex-wrap: wrap; align-items: center;';
    
    const label = document.createElement('span');
    label.style.cssText = 'font-size: 0.75rem; color: var(--text-secondary, #636e72); font-weight: bold;';
    label.innerText = 'Export Full Report:';
    toolbar.appendChild(label);

    const formats = [
        { name: 'Word (.docx)', type: 'word', bg: '#2b579a' },
        { name: 'PPTX (.pptx)', type: 'powerpoint', bg: '#d24726' },
        { name: 'Excel (.xlsx)', type: 'excel', bg: '#217346' },
        { name: 'PDF (.pdf)', type: 'pdf', bg: '#d9534f' }
    ];

    formats.forEach(fmt => {
        const btn = document.createElement('button');
        btn.style.cssText = `background: ${fmt.bg}; color: white; border: none; padding: 5px 10px; border-radius: 4px; font-size: 0.75rem; font-weight: 500; cursor: pointer; transition: opacity 0.2s;`;
        btn.innerText = fmt.name;
        btn.onmouseover = () => btn.style.opacity = '0.85';
        btn.onmouseout = () => btn.style.opacity = '1';
        btn.onclick = () => downloadReport(fmt.type, title, textContent, container);
        toolbar.appendChild(btn);
    });

    container.appendChild(toolbar);
}

// ADVANCED VISUAL & DIAGRAM RENDERING ENGINE
function renderVisualOutputs(text, containerElement) {
    let jsonMatches = [...text.matchAll(/```json\s*([\s\S]*?)\s*(```|$)/g)];
    let cleanText = text
        .replace(/```json[\s\S]*?(```|$)/g, '')
        .replace(/(Here is|Here's) (a|the) JSON (block|payload|data).*?:?/gi, '')
        .replace(/Here is (a|the) chart payload.*?:?/gi, '')
        .trim();

    containerElement.innerHTML = formatMarkdownText(cleanText);

    let extractedPayloads = [];

    jsonMatches.forEach(match => {
        try {
            let rawMatch = match[1].trim();
            let firstBrace = rawMatch.indexOf('{');
            let lastBrace = rawMatch.lastIndexOf('}');
            
            if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                rawMatch = rawMatch.substring(firstBrace, lastBrace + 1);
            }

            let jsonString = rawMatch.replace(/,\s*([\]}])/g, '$1');
            extractedPayloads.push(JSON.parse(jsonString));
        } catch (err) {
            console.error("JSON parse error:", err);
        }
    });

    const userPrompt = document.querySelector('.user-message:last-of-type')?.innerText || '';
    const promptLower = userPrompt.toLowerCase();
    
    const explicitFileRequest = promptLower.includes('generate file') || 
                                promptLower.includes('export') || 
                                promptLower.includes('download') || 
                                promptLower.includes('create document') || 
                                promptLower.includes('make ppt');

    let lastTablePayload = null;
    let reportTitle = "Executive Analysis";

    extractedPayloads.forEach((payload, pIdx) => {
        if (payload.title) reportTitle = payload.title;

        // Pareto Transformation
        const isPareto = payload.renderType === 'pareto' || (payload.title && payload.title.toLowerCase().includes('pareto'));
        if (isPareto && payload.labels && (payload.data || (payload.datasets && payload.datasets[0].data))) {
            const rawData = payload.data || payload.datasets[0].data;
            const sortedData = payload.labels.map((label, i) => ({
                label: label,
                value: Number(rawData[i]) || 0
            })).sort((a, b) => b.value - a.value);

            const labels = sortedData.map(d => d.label);
            const counts = sortedData.map(d => d.value);
            const total = counts.reduce((acc, v) => acc + v, 0) || 1;

            let currentSum = 0;
            const cumPercentages = counts.map(v => {
                currentSum += v;
                return parseFloat(((currentSum / total) * 100).toFixed(1));
            });

            payload.renderType = 'chart';
            payload.type = 'bar';
            payload.labels = labels;
            payload.datasets = [
                { label: 'Count', data: counts, type: 'bar', yAxisID: 'y' },
                { label: 'Cumulative %', data: cumPercentages, type: 'line', yAxisID: 'y1' }
            ];
        }

        // Waterfall Transformation
        const isWaterfall = payload.renderType === 'waterfall' || (payload.title && payload.title.toLowerCase().includes('waterfall'));
        if (isWaterfall && payload.labels && payload.data) {
            const rawValues = payload.data;
            const isTotalFlags = payload.isTotal || [];
            let runningTotal = 0;
            const floatData = [];
            const bgColors = [];

            rawValues.forEach((val, i) => {
                const isTotal = isTotalFlags[i] || false;
                if (isTotal) {
                    floatData.push([0, runningTotal]);
                    bgColors.push('rgba(108, 92, 231, 0.85)');
                } else {
                    const start = runningTotal;
                    runningTotal += val;
                    floatData.push([start, runningTotal]);
                    bgColors.push(val >= 0 ? 'rgba(46, 204, 113, 0.85)' : 'rgba(231, 76, 60, 0.85)');
                }
            });

            payload.renderType = 'chart';
            payload.type = 'bar';
            payload.datasets = [{
                label: 'Financial Flow',
                data: floatData,
                backgroundColor: bgColors,
                borderWidth: 1
            }];
        }

        // Table & Heatmap Engine
        if ((payload.renderType === 'table' || payload.renderType === 'heatmap') && payload.headers && payload.rows) {
            lastTablePayload = payload;
            const tableContainer = document.createElement('div');
            tableContainer.className = 'table-container';
            
            let html = `<h4 style="margin-bottom: 8px;">${payload.title || 'Data Matrix Summary'}</h4><table><thead><tr>`;
            payload.headers.forEach(h => { html += `<th>${h}</th>`; });
            html += '</tr></thead><tbody>';
            
            payload.rows.forEach(row => {
                html += '<tr>';
                row.forEach((cell, idx) => { 
                    const num = parseFloat(cell);
                    let bgStyle = '';
                    if (!isNaN(num) && idx > 0 && (payload.renderType === 'heatmap' || (payload.title && payload.title.toLowerCase().includes('heatmap')))) {
                        const alpha = Math.min(Math.max(num / 100, 0.15), 0.85);
                        bgStyle = ` style="background-color: rgba(108, 92, 231, ${alpha}); color: #fff; font-weight: bold; text-align: center;"`;
                    }
                    html += `<td${bgStyle}>${cell}</td>`; 
                });
                html += '</tr>';
            });
            html += '</tbody></table>';

            tableContainer.innerHTML = html;
            containerElement.appendChild(tableContainer);
        }

        // Diagram, Flowchart & Roadmap Engine (Mermaid.js)
        if (payload.renderType === 'diagram' && payload.code) {
            const diagramWrapper = document.createElement('div');
            diagramWrapper.className = 'diagram-wrapper';
            diagramWrapper.style.cssText = 'padding: 16px; background: rgba(255, 255, 255, 0.05); border-radius: 8px; margin-top: 12px; text-align: center; overflow-x: auto;';

            if (payload.title) {
                const titleEl = document.createElement('h4');
                titleEl.style.cssText = 'margin-bottom: 12px; color: var(--text-primary); font-size: 1rem;';
                titleEl.innerText = payload.title;
                diagramWrapper.appendChild(titleEl);
            }

            const mermaidDiv = document.createElement('div');
            mermaidDiv.className = 'mermaid';
            mermaidDiv.id = `mermaid-node-${Date.now()}-${pIdx}`;
            mermaidDiv.textContent = payload.code;
            diagramWrapper.appendChild(mermaidDiv);
            containerElement.appendChild(diagramWrapper);

            setTimeout(() => {
                try {
                    if (typeof mermaid !== 'undefined') {
                        mermaid.run({ nodes: [mermaidDiv] });
                    }
                } catch (err) {
                    console.error("Mermaid rendering error:", err);
                }
            }, 100);
        }

        // Chart.js Engine (Bar, Line, Pie, Donut, Scatter, Area)
        if ((payload.renderType === 'chart' || payload.type) && payload.datasets) {
            const chartWrapper = document.createElement('div');
            chartWrapper.className = 'chart-wrapper';
            
            const canvas = document.createElement('canvas');
            chartWrapper.appendChild(canvas);
            containerElement.appendChild(chartWrapper);

            const palette = [
                'rgba(108, 92, 231, 0.8)',
                'rgba(255, 107, 107, 0.8)',
                'rgba(84, 160, 255, 0.8)',
                'rgba(29, 209, 161, 0.8)',
                'rgba(254, 202, 87, 0.8)',
                'rgba(155, 89, 182, 0.8)'
            ];

            const isPieOrDonut = payload.type === 'pie' || payload.type === 'doughnut';

            const formattedDatasets = payload.datasets.map((ds, idx) => {
                return {
                    label: ds.label || `Series ${idx + 1}`,
                    data: ds.data,
                    type: ds.type || payload.type || 'bar',
                    backgroundColor: isPieOrDonut ? palette : (ds.backgroundColor || palette[idx % palette.length]),
                    borderColor: isPieOrDonut ? '#ffffff' : (ds.borderColor || palette[idx % palette.length].replace('0.8', '1')),
                    borderWidth: 2,
                    yAxisID: ds.yAxisID || 'y',
                    tension: 0.35
                };
            });

            const isStacked = payload.stacked || false;
            const isScatter = payload.type === 'scatter';

            const newChart = new Chart(canvas, {
                type: payload.type || 'bar',
                data: {
                    labels: isScatter ? undefined : payload.labels,
                    datasets: formattedDatasets
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: { duration: 0 },
                    plugins: {
                        title: { display: true, text: payload.title || 'Data Analysis' },
                        legend: { display: true, position: 'bottom' }
                    },
                    scales: isPieOrDonut ? {} : (isScatter ? {
                        x: { type: 'linear', position: 'bottom' },
                        y: { type: 'linear', position: 'left' }
                    } : {
                        x: { stacked: isStacked },
                        y: {
                            stacked: isStacked,
                            type: 'linear',
                            position: 'left'
                        },
                        y1: payload.datasets.some(ds => ds.yAxisID === 'y1') ? {
                            type: 'linear',
                            position: 'right',
                            min: 0,
                            max: 100,
                            grid: { drawOnChartArea: false }
                        } : undefined
                    })
                }
            });

            canvas.chartInstance = newChart;
        }
    });

    if (extractedPayloads.length > 0 || explicitFileRequest) {
        renderExportToolbar(containerElement, reportTitle, cleanText);
    }
}

// CHAT TRANSMISSION & HISTORY TRACKING
async function sendMessage() {
    const inputField = document.getElementById('user-input');
    const chatContainer = document.getElementById('chat-messages');
    
    if (!inputField || !chatContainer) return;
    const message = inputField.value.trim();
    if (!message && attachedFiles.length === 0 && attachedImages.length === 0) return;

    const userDiv = document.createElement('div');
    userDiv.className = 'user-message';
    userDiv.innerText = message || "(Attached inputs for analysis)";
    chatContainer.appendChild(userDiv);

    conversationHistory.push({ role: 'user', content: message });

    inputField.value = '';

    const aiDiv = document.createElement('div');
    aiDiv.className = 'ai-message';
    chatContainer.appendChild(aiDiv);

    chatContainer.scrollTop = chatContainer.scrollHeight;

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: message,
                history: conversationHistory,
                file_contexts: attachedFiles,
                images: attachedImages
            })
        });

        attachedFiles = [];
        attachedImages = [];
        const previewContainer = document.getElementById('preview-container');
        if (previewContainer) previewContainer.innerHTML = '';

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullText = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');
            
            for (let line of lines) {
                if (line.startsWith('data: ')) {
                    let rawChunk = line.replace('data: ', '');
                    let unescapedChunk = rawChunk.replace(/\\n/g, '\n');
                    fullText += unescapedChunk;
                    
                    let displayStreamText = fullText
                        .replace(/```json[\s\S]*?(```|$)/g, '')
                        .replace(/(Here is|Here's) (a|the) JSON (block|payload|data).*?:?/gi, '')
                        .replace(/Here is (a|the) chart payload.*?:?/gi, '')
                        .trim();
                    
                    aiDiv.innerHTML = formatMarkdownText(displayStreamText || "...");
                    chatContainer.scrollTop = chatContainer.scrollHeight;
                }
            }
        }

        renderVisualOutputs(fullText, aiDiv);
        
        const cleanAssistantContent = fullText.replace(/```json[\s\S]*?```/g, '').trim();
        conversationHistory.push({ role: 'assistant', content: cleanAssistantContent });

    } catch (err) {
        aiDiv.innerText = "Error connecting to server.";
        console.error(err);
    }
}

// Lightweight Markdown parser for clean UI rendering
function formatMarkdownText(text) {
    if (!text) return '';
    let formatted = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n\* /g, '<br>• ')
        .replace(/\n- /g, '<br>• ')
        .replace(/\n/g, '<br>');
    return formatted;
}