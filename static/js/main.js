let attachedFiles = [];
let attachedImages = [];

// Configure PDF.js Worker
if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

document.addEventListener('DOMContentLoaded', () => {
    const sendBtn = document.getElementById('send-btn');
    const userInput = document.getElementById('user-input');
    const fileInput = document.getElementById('file-input');
    const chatContainer = document.getElementById('chat-messages');

    if (sendBtn) sendBtn.addEventListener('click', sendMessage);
    if (userInput) {
        userInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });
        
        // Clipboard Image Paste Handler
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

// ==========================================
// MULTI-FORMAT FILE PARSING ENGINE
// ==========================================

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
            const summary = `CSV Summary (${results.data.length} rows):\nHeaders: ${results.meta.fields.join(', ')}\nSample Data:\n` + 
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
        
        let extractedText = `Excel Workbook: ${file.name}\nSheets: ${workbook.SheetNames.join(', ')}\n\n`;

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
            let fullText = `PDF Document: ${file.name} (${pdf.numPages} pages)\n\n`;
            
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

// Attachment Removal Controls
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

// ==========================================
// VISUAL RENDERING ENGINE
// ==========================================

function renderVisualOutputs(text, containerElement) {
    // 1. Extract ALL JSON blocks contained in ```json ``` codeblocks or raw braces
    const jsonMatches = [...text.matchAll(/```json\s*([\s\S]*?)\s*```/g)];
    
    if (jsonMatches.length === 0) return;

    // Clean text container: Strip out ALL raw JSON strings so no code leaks into the message bubble
    let cleanText = text;
    jsonMatches.forEach(match => {
        cleanText = cleanText.replace(match[0], '');
    });
    containerElement.innerText = cleanText.trim();

    // 2. Loop through every detected JSON payload and render its corresponding table/chart
    jsonMatches.forEach(match => {
        try {
            let jsonString = match[1].trim().replace(/,\s*([\]}])/g, '$1'); // Auto-repair trailing commas
            const payload = JSON.parse(jsonString);

            // A. PARETO CHART AUTO-CALCULATION ENGINE
            if (payload.renderType === 'pareto' || payload.type === 'pareto') {
                const sortedData = payload.labels.map((label, i) => ({
                    label: label,
                    value: payload.data[i]
                })).sort((a, b) => b.value - a.value);

                const labels = sortedData.map(d => d.label);
                const counts = sortedData.map(d => d.value);
                const total = counts.reduce((acc, v) => acc + v, 0);

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

            // B. COLUMNAR DATA TABLE RENDERING
            if (payload.renderType === 'table' && payload.headers && payload.rows) {
                const tableContainer = document.createElement('div');
                tableContainer.style.cssText = 'margin-top: 15px; overflow-x: auto; background: #ffffff; padding: 12px; border-radius: 8px; border: 1px solid #e0e0e0;';
                
                let html = `<h4 style="margin-bottom: 8px; color: #2d3436;">${payload.title || 'Summary Table'}</h4>`;
                html += '<table style="width: 100%; border-collapse: collapse; font-size: 0.9rem; text-align: left;"><thead><tr style="background: #f4f6f9;">';
                
                payload.headers.forEach(h => {
                    html += `<th style="padding: 8px; border-bottom: 2px solid #ddd;">${h}</th>`;
                });
                html += '</tr></thead><tbody>';

                payload.rows.forEach(row => {
                    html += '<tr>';
                    row.forEach(cell => {
                        html += `<td style="padding: 8px; border-bottom: 1px solid #eee;">${cell}</td>`;
                    });
                    html += '</tr>';
                });
                html += '</tbody></table>';

                tableContainer.innerHTML = html;
                containerElement.appendChild(tableContainer);
            }

            // C. CHART.JS RENDERING (BAR, PIE, LINE, DUAL-AXIS)
            if (payload.renderType === 'chart' && payload.labels && payload.datasets) {
                const chartWrapper = document.createElement('div');
                chartWrapper.style.cssText = 'margin-top: 15px; background: #ffffff; padding: 15px; border-radius: 8px; border: 1px solid #e0e0e0; position: relative; width: 100%; min-height: 320px;';
                
                const canvas = document.createElement('canvas');
                chartWrapper.appendChild(canvas);
                containerElement.appendChild(chartWrapper);

                const colors = [
                    'rgba(108, 92, 231, 0.7)',
                    'rgba(255, 107, 107, 0.7)',
                    'rgba(84, 160, 255, 0.7)',
                    'rgba(29, 209, 161, 0.7)',
                    'rgba(254, 202, 87, 0.7)'
                ];

                const formattedDatasets = payload.datasets.map((ds, idx) => {
                    const isLine = ds.type === 'line';
                    return {
                        label: ds.label || `Metric ${idx + 1}`,
                        data: ds.data,
                        type: ds.type || payload.type || 'bar',
                        backgroundColor: isLine ? 'rgba(255, 107, 107, 0.2)' : colors[idx % colors.length],
                        borderColor: isLine ? '#ff6b6b' : colors[idx % colors.length].replace('0.7', '1'),
                        borderWidth: 2,
                        yAxisID: ds.yAxisID || 'y',
                        tension: 0.2
                    };
                });

                const hasDualAxis = payload.datasets.some(ds => ds.yAxisID === 'y1');

                new Chart(canvas, {
                    type: payload.type || 'bar',
                    data: {
                        labels: payload.labels,
                        datasets: formattedDatasets
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            title: { display: true, text: payload.title || 'Data Analysis' },
                            legend: { display: true, position: 'bottom' }
                        },
                        scales: payload.type === 'pie' || payload.type === 'doughnut' ? {} : {
                            y: {
                                type: 'linear',
                                display: true,
                                position: 'left',
                                title: { display: true, text: 'Frequency / Count' }
                            },
                            y1: hasDualAxis ? {
                                type: 'linear',
                                display: true,
                                position: 'right',
                                min: 0,
                                max: 100,
                                grid: { drawOnChartArea: false },
                                title: { display: true, text: 'Cumulative %' }
                            } : undefined
                        }
                    }
                });
            }
        } catch (err) {
            console.error("Failed to parse visual payload block:", err);
        }
    });
}

// ==========================================
// CHAT TRANSMISSION ENGINE
// ==========================================

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
                    fullText += line.replace('data: ', '');
                    aiDiv.innerText = fullText;
                    chatContainer.scrollTop = chatContainer.scrollHeight;
                }
            }
        }

        renderVisualOutputs(fullText, aiDiv);

    } catch (err) {
        aiDiv.innerText = "Error connecting to server.";
        console.error(err);
    }
}