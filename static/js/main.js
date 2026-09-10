let attachedImages = [];
let attachedFiles = [];

// Clipboard Paste Listener
document.addEventListener('paste', function (e) {
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.indexOf('image') !== -1) {
            processImageFile(item.getAsFile());
        } else if (item.kind === 'file') {
            processTextFile(item.getAsFile());
        }
    }
});

function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
}

function clearChat() {
    document.getElementById('chatBox').innerHTML = '';
    clearAttachments();
}

function handleFileSelect(event) {
    const files = Array.from(event.target.files);
    files.forEach(file => {
        if (file.type.startsWith('image/')) {
            processImageFile(file);
        } else {
            processTextFile(file);
        }
    });
    document.getElementById('fileInput').value = '';
}

function processImageFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
        const fullBase64 = e.target.result;
        const base64Data = fullBase64.split(',')[1];
        attachedImages.push({ full: fullBase64, data: base64Data });
        renderPreviews();
    };
    reader.readAsDataURL(file);
}

function processTextFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
        attachedFiles.push({
            name: file.name || "pasted_file.txt",
            content: e.target.result.substring(0, 4000)
        });
        renderPreviews();
    };
    reader.readAsText(file);
}

function removeImage(index) {
    attachedImages.splice(index, 1);
    renderPreviews();
}

function removeFile(index) {
    attachedFiles.splice(index, 1);
    renderPreviews();
}

function clearAttachments() {
    attachedImages = [];
    attachedFiles = [];
    renderPreviews();
}

function renderPreviews() {
    const previewArea = document.getElementById('previewArea');
    previewArea.innerHTML = '';

    attachedImages.forEach((img, index) => {
        const div = document.createElement('div');
        div.className = 'preview-item';
        div.innerHTML = `
            <img src="${img.full}">
            <button onclick="removeImage(${index})">✕</button>
        `;
        previewArea.appendChild(div);
    });

    attachedFiles.forEach((file, index) => {
        const div = document.createElement('div');
        div.className = 'preview-item';
        div.innerHTML = `
            <div class="file-badge">
                📄 ${file.name}
                <button onclick="removeFile(${index})">✕</button>
            </div>
        `;
        previewArea.appendChild(div);
    });
}

async function sendMessage() {
    const input = document.getElementById('userInput');
    const msg = input.value.trim();
    if (!msg && attachedImages.length === 0 && attachedFiles.length === 0) return;

    const chatBox = document.getElementById('chatBox');
    const userDiv = document.createElement('div');
    userDiv.className = 'message user';

    if (attachedImages.length > 0) {
        const imgContainer = document.createElement('div');
        imgContainer.className = 'message-attachments';
        attachedImages.forEach(img => {
            const imageEl = document.createElement('img');
            imageEl.src = img.full;
            imgContainer.appendChild(imageEl);
        });
        userDiv.appendChild(imgContainer);
    }

    let userDisplayMsg = msg;
    if (attachedFiles.length > 0) {
        const fileNames = attachedFiles.map(f => f.name).join(', ');
        userDisplayMsg = `[Attached Files: ${fileNames}]\n` + (msg || "Please analyze these files.");
    }

    const textSpan = document.createElement('span');
    textSpan.innerText = userDisplayMsg || "Analyze attached inputs.";
    userDiv.appendChild(textSpan);
    chatBox.appendChild(userDiv);

    input.value = '';

    const imagesPayload = attachedImages.map(img => img.data);
    const filesPayload = [...attachedFiles];

    clearAttachments();

    const assistantDiv = document.createElement('div');
    assistantDiv.className = 'message assistant';
    assistantDiv.innerText = '...';
    chatBox.appendChild(assistantDiv);
    chatBox.scrollTop = chatBox.scrollHeight;

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: msg || "Please analyze all provided inputs and give feedback.",
                images: imagesPayload,
                file_contexts: filesPayload
            })
        });

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        assistantDiv.innerText = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value);
            const lines = chunk.split('\n\n');
            lines.forEach(line => {
                if (line.startsWith('data: ')) {
                    assistantDiv.innerText += line.replace('data: ', '');
                }
            });
        }

        // Parse and render canvas charts once response completes
        renderChartFromText(assistantDiv.innerText, assistantDiv);

    } catch (e) {
        assistantDiv.innerText = "Error processing request.";
    }
}
// Add inside static/js/main.js
function renderChartFromText(text, container) {
    // Match any backtick-wrapped JSON or raw JSON object
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/(\{[\s\S]*"type"[\s\S]*\})/);
    
    if (jsonMatch) {
        try {
            const payload = JSON.parse(jsonMatch[1] || jsonMatch[0]);
            
            // Immediately strip the raw JSON out of the chat text bubble
            container.innerText = text.replace(jsonMatch[0], '').trim();

            if (!payload.type) return;

            // RENDER KPI CARDS
            if (payload.type === 'kpi' && payload.metrics) {
                const kpiGrid = document.createElement('div');
                kpiGrid.style.cssText = 'display: flex; gap: 10px; flex-wrap: wrap; margin-top: 12px;';
                payload.metrics.forEach(m => {
                    const card = document.createElement('div');
                    card.style.cssText = 'flex: 1; min-width: 120px; background: #f0f4ff; border-left: 4px solid #667eea; padding: 10px; border-radius: 6px;';
                    card.innerHTML = `<div style="font-size: 11px; color: #555;">${m.label}</div><div style="font-size: 18px; font-weight: bold; color: #1e1b4b;">${m.value}</div>`;
                    kpiGrid.appendChild(card);
                });
                container.appendChild(kpiGrid);
                return;
            }

            // RENDER TABLES
            if (payload.type === 'table' && payload.headers && payload.rows) {
                const tableWrapper = document.createElement('div');
                tableWrapper.style.cssText = 'margin-top: 12px; overflow-x: auto; border: 1px solid #e2e8f0; border-radius: 6px;';
                let tableHTML = '<table style="width: 100%; border-collapse: collapse; font-size: 13px; text-align: left;">';
                tableHTML += '<thead style="background: #f8fafc;"><tr>' + payload.headers.map(h => `<th style="padding: 8px 12px; border-bottom: 2px solid #e2e8f0;">${h}</th>`).join('') + '</tr></thead><tbody>';
                payload.rows.forEach(row => {
                    tableHTML += '<tr style="border-bottom: 1px solid #f1f5f9;">' + row.map(cell => `<td style="padding: 8px 12px;">${cell}</td>`).join('') + '</tr>';
                });
                tableHTML += '</tbody></table>';
                tableWrapper.innerHTML = tableHTML;
                container.appendChild(tableWrapper);
                return;
            }

            // RENDER CHARTS
            if (payload.labels) {
                const chartWrapper = document.createElement('div');
                chartWrapper.style.cssText = 'margin-top: 12px; padding: 10px; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0;';
                const canvas = document.createElement('canvas');
                chartWrapper.appendChild(canvas);
                container.appendChild(chartWrapper);

                const validTypes = ['bar', 'line', 'pie', 'doughnut', 'radar', 'polarArea'];
                const chartType = validTypes.includes(payload.type) ? payload.type : 'bar';

                const palette = ['rgba(102, 126, 234, 0.85)', 'rgba(139, 92, 246, 0.85)', 'rgba(236, 72, 153, 0.85)', 'rgba(245, 158, 11, 0.85)'];

                let datasets = [];
                if (payload.datasets && Array.isArray(payload.datasets)) {
                    datasets = payload.datasets.map((ds, idx) => ({
                        label: ds.label || `Series ${idx + 1}`,
                        data: ds.data,
                        backgroundColor: palette[idx % palette.length],
                        borderColor: palette[idx % palette.length].replace('0.85', '1'),
                        borderWidth: 2
                    }));
                } else if (payload.data) {
                    datasets = [{
                        label: payload.title || payload.label || 'Data Analysis',
                        data: payload.data,
                        backgroundColor: ['pie', 'doughnut'].includes(chartType) ? palette : palette[0],
                        borderWidth: 1
                    }];
                }

                new Chart(canvas, {
                    type: chartType,
                    data: { labels: payload.labels, datasets: datasets },
                    options: { responsive: true, plugins: { legend: { display: true } } }
                });
            }
        } catch (e) {
            console.log("Visual JSON parse error:", e);
        }
    }
}