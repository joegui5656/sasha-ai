let attachedFiles = [];
let attachedImages = [];

document.addEventListener('DOMContentLoaded', () => {
    const sendBtn = document.getElementById('send-btn');
    const userInput = document.getElementById('user-input');
    const fileInput = document.getElementById('file-input');

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
});

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

function handleFileUpload(file) {
    if (!file) return;
    if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = function (e) {
            const base64Data = e.target.result.split(',')[1];
            attachedImages.push(base64Data);
            renderPreviews();
        };
        reader.readAsDataURL(file);
    } else {
        processTextFile(file);
    }
}

function renderPreviews() {
    const container = document.getElementById('preview-container');
    if (!container) return;
    container.innerHTML = '';

    attachedFiles.forEach((f) => {
        const pill = document.createElement('span');
        pill.style.cssText = 'background: #6c5ce7; color: white; padding: 4px 10px; border-radius: 12px; font-size: 0.8rem;';
        pill.innerText = `📄 ${f.name}`;
        container.appendChild(pill);
    });

    attachedImages.forEach((img, idx) => {
        const pill = document.createElement('span');
        pill.style.cssText = 'background: #00b894; color: white; padding: 4px 10px; border-radius: 12px; font-size: 0.8rem;';
        pill.innerText = `🖼️ Image ${idx + 1}`;
        container.appendChild(pill);
    });
}

function renderVisualOutputs(text, containerElement) {
    let jsonString = "";
    const markdownMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
    if (markdownMatch) {
        jsonString = markdownMatch[1].trim();
    } else {
        const braceMatch = text.match(/(\{[\s\S]*"renderType"[\s\S]*\})/);
        if (braceMatch) jsonString = braceMatch[0].trim();
    }

    if (!jsonString) return;

    try {
        // Repair common trailing commas in LLM outputs
        jsonString = jsonString.replace(/,\s*([\]}])/g, '$1');
        const payload = JSON.parse(jsonString);

        // Remove raw JSON code block from visible chat text
        if (markdownMatch) {
            containerElement.innerText = text.replace(markdownMatch[0], '').trim();
        }

        // 1. Client-Side Pareto Calculation Engine
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
                { label: 'Defect Count', data: counts, type: 'bar', yAxisID: 'y' },
                { label: 'Cumulative %', data: cumPercentages, type: 'line', yAxisID: 'y1' }
            ];
        }

        // 2. Render Columnar Data Tables
        if (payload.renderType === 'table' && payload.headers && payload.rows) {
            const tableContainer = document.createElement('div');
            tableContainer.style.cssText = 'margin-top: 15px; overflow-x: auto; background: #fff; padding: 12px; border-radius: 8px; border: 1px solid #e0e0e0;';
            
            let html = `<h4 style="margin-bottom: 8px; color: #2d3436;">${payload.title || 'Data Table'}</h4>`;
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

        // 3. Render Charts (Standard & Dual-Axis Multi-Series)
        if (payload.renderType === 'chart' && payload.labels && payload.datasets) {
            const chartWrapper = document.createElement('div');
            chartWrapper.style.cssText = 'margin-top: 15px; background: #fff; padding: 15px; border-radius: 8px; border: 1px solid #e0e0e0; position: relative; width: 100%; min-height: 320px;';
            
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
                    label: ds.label || `Dataset ${idx + 1}`,
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
                type: 'bar',
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
                    scales: {
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
        console.error("Failed to render visual output:", err, jsonString);
    }
}

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