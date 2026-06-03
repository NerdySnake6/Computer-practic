const express = require('express');
const multer = require('multer');
const { imageSize: sizeOf } = require('image-size');

const app = express();
const port = process.env.PORT || 3000;

// Настройка multer для хранения загруженных файлов в оперативной памяти
const upload = multer({ storage: multer.memoryStorage() });

// Маршрут /login
// Возвращает JSON {"author": "1167133"} с правильными заголовками
app.get('/login', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.status(200).json({ author: '1167133' });
});

// Маршрут /size2json
// Принимает картинку в поле "image" через форму multipart/form-data
// Возвращает размеры изображения или ошибку "invalid filetype"
app.post('/size2json', upload.single('image'), (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  if (!req.file) {
    return res.status(400).json({ error: 'Файл не загружен или неверное имя поля. Используйте "image".' });
  }

  try {
    const dimensions = sizeOf(req.file.buffer);
    
    // Проверка, что файл распознан как картинка и имеет размеры
    if (!dimensions || !dimensions.width || !dimensions.height) {
      return res.status(200).json({ result: 'invalid filetype' });
    }

    return res.status(200).json({
      width: dimensions.width,
      height: dimensions.height
    });
  } catch (err) {
    // Если библиотека не смогла распознать формат (например, передан текстовый файл), возвращаем ошибку
    return res.status(200).json({ result: 'invalid filetype' });
  }
});

// Запуск локального сервера
app.listen(port, () => {
  console.log(`Сервер запущен локально по адресу http://localhost:${port}`);
});
