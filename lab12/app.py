import io
import os
from flask import Flask, Response, jsonify, render_template, request
from PIL import Image, ImageDraw, ImageFont

# Инициализируем приложение Flask
app = Flask(__name__)

# Маршрут /login (метод GET)
# Возвращает JSON-ответ с логином автора
@app.route('/login', methods=['GET'])
def login():
    return jsonify({"author": "1167133"})

# Маршрут /badge для динамической генерации изображений с помощью Pillow
@app.route('/badge', methods=['GET'])
def badge():
    # Получаем параметры запроса
    text = request.args.get('text', 'Yandex Serverless')
    bg_color = request.args.get('bg', '#4F46E5') # Дефолтный фиолетовый
    text_color = request.args.get('fg', '#FFFFFF') # Дефолтный белый
    
    # Размеры изображения
    width = 300
    height = 80
    
    # Создаем изображение в режиме RGB
    image = Image.new('RGB', (width, height), color=bg_color)
    draw = ImageDraw.Draw(image)
    
    # Пытаемся загрузить шрифт, иначе используем дефолтный
    try:
        font = ImageFont.load_default()
    except IOError:
        font = None
        
    # Рисуем рамку вокруг баннера
    draw.rectangle([(5, 5), (width - 6, height - 6)], outline=text_color, width=2)
    
    # Вычисляем позицию текста (по центру)
    # Используем простую аппроксимацию размеров текста для совместимости
    text_len = len(text)
    char_width = 8
    char_height = 14
    text_w = text_len * char_width
    text_h = char_height
    
    x = (width - text_w) // 2
    y = (height - text_h) // 2
    
    # Рисуем текст на баннере
    draw.text((x, y), text, fill=text_color, font=font)
    
    # Сохраняем в буфер памяти
    img_byte_arr = io.BytesIO()
    image.save(img_byte_arr, format='PNG')
    img_byte_arr = img_byte_arr.getvalue()
    
    return Response(img_byte_arr, mimetype='image/png')

# Маршрут / (метод GET)
# Возвращает HTML-страницу с отчетом
@app.route('/', methods=['GET'])
def index():
    return render_template('index.html')

if __name__ == '__main__':
    # Слушаем порт 8080 (стандартный для serverless контейнеров Yandex Cloud)
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port)
