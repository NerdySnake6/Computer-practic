#!/bin/bash
set -e

# Путь к исполняемому файлу Yandex Cloud CLI
YC="/Users/nerdysnake6/yandex-cloud/bin/yc"
export PATH="/Users/nerdysnake6/yandex-cloud/bin:$PATH"

# 1. Настройка докера для работы с реестром Yandex Container Registry
$YC container registry configure-docker > /dev/null

# 2. Проверка наличия и создание сервисного аккаунта flask-app-sa
SA_ID=$($YC iam service-account get --name flask-app-sa --format json 2>/dev/null | python3 -c "import sys, json; data=sys.stdin.read(); print(json.loads(data).get('id', '')) if data.strip() else print('')" || true)

if [ -z "$SA_ID" ]; then
    SA_ID=$($YC iam service-account create --name flask-app-sa --format json | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])")
    FOLDER_ID=$($YC config get folder-id)
    $YC resource-manager folder add-access-binding "$FOLDER_ID" --role container-registry.images.puller --subject serviceAccount:"$SA_ID" >/dev/null
fi

# 3. Проверка наличия и получение реестра flask-app-registry
REGISTRY_ID=$($YC container registry get --name flask-app-registry --format json 2>/dev/null | python3 -c "import sys, json; data=sys.stdin.read(); print(json.loads(data).get('id', '')) if data.strip() else print('')" || true)

if [ -z "$REGISTRY_ID" ]; then
    REGISTRY_ID=$($YC container registry create --name flask-app-registry --format json | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])")
fi

# 4. Сборка Docker-образа на платформе linux/amd64 с тегом
IMAGE_TAG="cr.yandex/$REGISTRY_ID/flask-app:latest"
docker build --platform linux/amd64 -t "$IMAGE_TAG" .

# 5. Загрузка собранного образа в созданный registry
docker push "$IMAGE_TAG"

# 6. Развертывание сервиса в Yandex Cloud Serverless
CONTAINER_EXISTS=$($YC serverless container get --name flask-app-container --format json 2>/dev/null | python3 -c "import sys, json; data=sys.stdin.read(); print(json.loads(data).get('id', '')) if data.strip() else print('')" || true)

if [ -z "$CONTAINER_EXISTS" ]; then
    # Создаем контейнер, если его нет
    $YC serverless container create --name flask-app-container > /dev/null
fi

# Развертываем новую ревизию с загруженным образом и привязанным сервисным аккаунтом
$YC serverless container revision deploy \
  --container-name flask-app-container \
  --image "$IMAGE_TAG" \
  --cores 1 \
  --memory 128MB \
  --concurrency 8 \
  --service-account-id "$SA_ID" \
  --format json > /dev/null

# Делаем сервис публичным (разрешаем доступ всем пользователям)
$YC serverless container allow-unauthenticated-invoke flask-app-container > /dev/null

# 7. Получение и вывод HTTP-ссылки на развернутый сервис
HTTP_URL=$($YC serverless container get --name flask-app-container --format json | python3 -c "import sys, json; print(json.load(sys.stdin)['url'])")
echo "$HTTP_URL"
