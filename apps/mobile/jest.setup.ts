// Testlerde .env yüklenmez; API adresi sabit bir test adresidir (gerçek ağ çağrısı yapılmaz, fetch taklit edilir).
process.env.EXPO_PUBLIC_API_URL = 'http://api.test';
