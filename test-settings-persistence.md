      # AccessiMind Kalıcı Ayar Yönetimi Test Rehberi

## 🔧 Yeni Özellikler

AccessiMind artık ayarlarınızı VS Code restart edildiğinde bile kalıcı olarak saklayabilir!

### 📋 Yeni Komutlar

1. **AccessiMind: Restore Persistent Settings**
   - Kalıcı storage'dan ayarları geri yükler
   - `Ctrl+Shift+P` → "AccessiMind: Restore Persistent Settings"

2. **AccessiMind: Export Settings**
   - Ayarlarınızı JSON dosyası olarak dışa aktarır
   - `Ctrl+Shift+P` → "AccessiMind: Export Settings"

3. **AccessiMind: Import Settings**
   - JSON dosyasından ayarları içe aktarır
   - `Ctrl+Shift+P` → "AccessiMind: Import Settings"

4. **AccessiMind: Clear Persistent Settings**
   - Tüm kalıcı ayarları temizler
   - `Ctrl+Shift+P` → "AccessiMind: Clear Persistent Settings"

5. **AccessiMind: Show Settings Status**
   - Ayar durumunu gösterir (cache, global, workspace)
   - `Ctrl+Shift+P` → "AccessiMind: Show Settings Status"

## 🧪 Test Adımları

### 1. Extension'ı Yükleyin ve Ayarları Yapın
```
1. VS Code'u açın
2. AccessiMind extension'ını yükleyin
3. Settings panelinden AI provider, API key vb. ayarları yapın
4. Dil ayarını değiştirin (EN/TR)
5. WCAG seviyesini ayarlayın (A/AA/AAA)
```

### 2. Kalıcı Ayarları Test Edin
```
1. Ayarları yaptıktan sonra VS Code'u tamamen kapatın
2. VS Code'u yeniden açın
3. AccessiMind ayarlarını kontrol edin
4. Ayarların korunup korunmadığını görmek için:
   - Command Palette → "AccessiMind: Show Settings Status"
```

### 3. Ayar Dışa/İçe Aktarma Testi
```
1. Command Palette → "AccessiMind: Export Settings"
2. JSON dosyasını kaydedin
3. Command Palette → "AccessiMind: Clear Persistent Settings"
4. VS Code'u restart edin
5. Command Palette → "AccessiMind: Import Settings"
6. Kaydettiğiniz JSON dosyasını seçin
7. Ayarların geri döndüğünü kontrol edin
```

### 4. Otomatik Geri Yükleme Testi
```
1. Ayarları yapın
2. VS Code'u kapatın
3. VS Code'u tekrar açın
4. Extension aktivasyon sırasında ayarların otomatik olarak 
   geri yüklendiğini kontrol edin
```

## 🔍 Teknik Detaylar

### Kalıcı Depolama Sistemi
- **Global State**: Tüm workspace'ler için geçerli ayarlar
- **Workspace State**: Sadece mevcut workspace için ayarlar
- **Configuration Sync**: VS Code configuration ile otomatik senkronizasyon
- **Cache System**: Hızlı erişim için memory cache

### Güvenlik
- API anahtarları güvenli şekilde saklanır
- Hassas bilgiler log'lanmaz
- Configuration validation yapılır

### Desteklenen Ayarlar
- ✅ AI Provider (Gemini/Copilot)
- ✅ API Keys
- ✅ AI Models
- ✅ Language Settings (EN/TR)
- ✅ WCAG Level (A/AA/AAA)
- ✅ Interface Preferences
- ✅ Keyboard Shortcuts
- ✅ Jira Configuration
- ✅ All Custom Settings

## 🚨 Sorun Giderme

### Ayarlar Kayboluyorsa
1. `Ctrl+Shift+P` → "AccessiMind: Show Settings Status"
2. Persistent settings durumunu kontrol edin
3. Gerekirse: "AccessiMind: Restore Persistent Settings"

### Backup Almak İçin
1. `Ctrl+Shift+P` → "AccessiMind: Export Settings"
2. JSON dosyasını güvenli bir yere kaydedin

### Reset İçin
1. `Ctrl+Shift+P` → "AccessiMind: Clear Persistent Settings"
2. VS Code'u restart edin
3. Ayarları yeniden yapın

## ✅ Beklenen Sonuçlar

- ✅ VS Code restart sonrası ayarlar korunur
- ✅ Extension aktivasyon sırasında ayarlar otomatik yüklenir  
- ✅ Ayar değişiklikleri anında kalıcı storage'a kaydedilir
- ✅ Import/Export işlemleri sorunsuz çalışır
- ✅ Configuration validation yapılır
- ✅ Hata durumlarında bilgilendirme mesajları gösterilir

Bu rehberi takip ederek AccessiMind'ın yeni kalıcı ayar yönetimi özelliklerini test edebilirsiniz!

## 🔄 Ek Test: Sihirbaz ve İstatistik Özellikleri

### Sihirbaz Kalıcı Ayar Testi
```
1. Command Palette → "AccessiMind: Show Welcome Guide"
2. Sihirbazı kullanarak AI provider, model, API key vb. ayarları yapın
3. Sihirbazı bitirin
4. VS Code'u restart edin
5. Ayarların korunduğunu kontrol edin
```

### İstatistik Export/Reset Testi
```
1. AccessiMind sidebar'ında Statistics panelini açın
2. Export düğmesini test edin:
   - JSON formatında export
   - CSV formatında export
3. Reset düğmelerini test edin:
   - Günlük istatistik sıfırlama
   - Aylık istatistik sıfırlama
   - Yıllık istatistik sıfırlama
   - Tüm istatistikleri sıfırlama
4. Modern Statistics panelini de test edin
```

### 🎯 Yeni Özellik Özeti

✅ **Kalıcı Ayar Sistemi**
- Extension context storage (Global + Workspace state)
- Otomatik configuration backup
- Real-time setting synchronization
- Import/Export functionality

✅ **Sihirbaz Entegrasyonu**
- Sihirbazda yapılan ayarlar kalıcı storage'a kaydedilir
- VS Code restart sonrası ayarlar korunur

✅ **İstatistik Yönetimi**
- Export: JSON/CSV formatlarında
- Reset: Günlük/Aylık/Yıllık/Tümü seçenekleri
- Modern ve klasik istatistik panelleri tam fonksiyonel

Bu güncellemeler sayesinde AccessiMind artık enterprise-grade bir extension haline geldi!