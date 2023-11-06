cd frontend
npm run build
cd ..
rm -rf public/dist
mv frontend/dist public/
npm run re-sqlite
npm run build-m
#npm run build-m-arm64
#npm run build-w
