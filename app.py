import os
from flask import Flask, render_template, send_file, request
from routes.chat_routes import chat_bp
from services.export_service import ExportService

app = Flask(__name__)

# Register the Blueprint for chat routes
app.register_blueprint(chat_bp)

# Root route for rendering the UI
@app.route('/')
def index():
    return render_template('index.html')

# Report export endpoint
@app.route('/api/export', methods=['POST'])
def export_file():
    data = request.json or {}
    file_type = data.get('file_type')
    title = data.get('title', 'Sasha AI Executive Report')
    insights = data.get('insights', [])

    # Capture multi-item lists with fallbacks for single-item payloads
    table_data_list = data.get('table_data_list', [])
    if not table_data_list and data.get('table_data'):
        table_data_list = [data.get('table_data')]

    chart_images_b64 = data.get('chart_images_b64', [])
    if not chart_images_b64 and data.get('chart_image_b64'):
        chart_images_b64 = [data.get('chart_image_b64')]

    if file_type == 'word':
        stream = ExportService.generate_word(title, insights, table_data_list, chart_images_b64)
        mimetype = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        filename = 'Sasha_Executive_Report.docx'
    elif file_type == 'powerpoint':
        stream = ExportService.generate_pptx(title, insights, table_data_list, chart_images_b64)
        mimetype = 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
        filename = 'Sasha_Executive_Report.pptx'
    elif file_type == 'excel':
        stream = ExportService.generate_excel(title, table_data_list)
        mimetype = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        filename = 'Sasha_Executive_Report.xlsx'
    else:
        stream = ExportService.generate_pdf(title, insights, table_data_list, chart_images_b64)
        mimetype = 'application/pdf'
        filename = 'Sasha_Executive_Report.pdf'

    return send_file(stream, mimetype=mimetype, as_attachment=True, download_name=filename)

if __name__ == '__main__':
    app.run(debug=True, port=5000)