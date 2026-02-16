# AccessiMind JSON Ayar Sistemi Test Rehberi

Bu döküman, implement ettiğimiz JSON tabanlı ayar sistemi için test senaryolarını içerir.

## Test Senaryoları

### 1. İlk Kurulum ve JSON Dosyası Oluşturma

**Test Adımları:**
1. Extension'ı temiz bir workspace'de ilk kez aktive et
2. `accessimind.json` dosyasının workspace root'unda oluştuğunu kontrol et
3. Dosya içeriğinin default değerlerle dolu olduğunu kontrol et

**Beklenen Sonuç:**
- `accessimind.json` dosyası oluşturulmalı
- `wizard.completed: false` olmalı
- Default ayarlar mevcut olmalı
- VS Code output panel'de başarı mesajı görünmeli

**Test Komutu:**
```bash
# VS Code'u yeni bir workspace ile başlat
code test-workspace/
```

### 2. Wizard Tamamlama ve JSON'a Kaydetme

**Test Adımları:**
1. Wizard'ı aç: `Ctrl+Shift+P` → "AccessiMind: Setup Wizard"
2. AI Provider seç (örn: Gemini)
3. Model seç (örn: Gemini 2.0 Flash)
4. API Key gir
5. WCAG Level seç (örn: AA)
6. Dil seç (örn: Türkçe)
7. Wizard'ı tamamla

**Beklenen Sonuç:**
- Her adımda JSON dosyası güncellenmeli
- `wizard.completed: true` olmalı
- `wizard.completedAt` tarih olmalı
- Tüm wizard step'leri `completed: true` olmalı
- "Settings applied" mesajı gösterilmeli

**Kontrol Komutu:**
```bash
# JSON dosyasını kontrol et
cat accessimind.json | jq '.wizard'
```

### 3. VS Code Restart Sonrası Ayarları Geri Yükleme

**Test Adımları:**
1. VS Code'u kapat
2. Tekrar aç
3. Extension aktivasyonunu bekle

**Beklenen Sonuç:**
- JSON dosyasından ayarlar yüklenmeli
- VS Code configuration'a uygulanmalı
- "Settings applied" mesajı gösterilmeli
- Wizard'ın tamamlandığı hatırlanmalı

**Kontrol Komutu:**
```bash
# VS Code settings'i kontrol et
code --list-extensions | grep accessimind
```

### 4. Manuel JSON Düzenleme ve Senkronizasyon

**Test Adımları:**
1. `accessimind.json` dosyasını manuel olarak düzenle
2. Örneğin `settings.wcagLevel`'ı "AAA" yap
3. Dosyayı kaydet
4. Birkaç saniye bekle

**Beklenen Sonuç:**
- File watcher değişikliği algılamalı
- VS Code configuration otomatik güncellemeli
- Log'larda senkronizasyon mesajı görünmeli

### 5. Error Handling ve Fallback Testleri

#### 5.1 Bozuk JSON Dosyası
**Test Adımları:**
1. JSON dosyasını bozuk hale getir (geçersiz JSON syntax)
2. Extension'ı restart et

**Beklenen Sonuç:**
- Backup dosyası oluşturulmalı
- Yeni default JSON dosyası oluşturulmalı
- Hata mesajı gösterilmeli

#### 5.2 Dosya İzin Sorunu
**Test Adımları:**
1. JSON dosyasını read-only yap
2. Wizard'da değişiklik yapmaya çalış

**Beklenen Sonuç:**
- Fallback lokasyonunda dosya oluşturulmalı
- Warning mesajı gösterilmeli

#### 5.3 Workspace Dışı Çalışma
**Test Adımları:**
1. Workspace olmayan bir ortamda extension'ı aktive et

**Beklenen Sonuç:**
- Extension path'inde fallback dosyası oluşturulmalı
- Normal çalışmaya devam etmeli

### 6. Komut Testleri

#### 6.1 JSON Durumu Gösterme
**Test Komutu:**
```bash
# Command Palette'de çalıştır:
AccessiMind: Show JSON Status
```

**Beklenen Sonuç:**
- JSON dosya yolu
- Wizard durumu
- Ayar özeti
- İstatistikler

#### 6.2 JSON Sağlık Kontrolü
**Test Komutu:**
```bash
AccessiMind: Validate JSON Health
```

**Beklenen Sonuç:**
- Dosya varlığı kontrolü
- JSON geçerliliği kontrolü
- İzin kontrolü

#### 6.3 JSON Onarım
**Test Komutu:**
```bash
AccessiMind: Repair JSON File
```

**Beklenen Sonuç:**
- Backup oluşturma
- Yeni dosya oluşturma
- Başarı mesajı

### 7. Performans Testleri

#### 7.1 Büyük JSON Dosyası
**Test Adımları:**
1. JSON dosyasına çok fazla istatistik verisi ekle
2. Extension performansını gözlemle

**Beklenen Sonuç:**
- Startup zamanı 3 saniyeyi geçmemeli
- File watcher responsive olmalı

#### 7.2 Sık Değişiklik
**Test Adımları:**
1. Programmatik olarak settings'i sık sık değiştir
2. JSON dosyasının doğru senkronize olduğunu kontrol et

**Beklenen Sonuç:**
- Throttling çalışmalı
- Dosya corruption olmamalı

## Manuel Test Prosedürü

### Ön Hazırlık
```bash
# Test workspace oluştur
mkdir test-accessimind-json
cd test-accessimind-json
code .
```

### Test Execution
1. **Temel Flow Test** (Senaryo 1, 2, 3)
2. **Error Handling Test** (Senaryo 5)
3. **Komut Test** (Senaryo 6)
4. **Performance Test** (Senaryo 7)

### Test Sonucu Değerlendirme

✅ **Başarılı Test Kriterleri:**
- JSON dosyası doğru oluşturuluyor
- Wizard ayarları persist ediliyor
- VS Code restart sonrası ayarlar korunuyor
- Error durumlarında graceful handling
- Tüm komutlar çalışıyor
- Performance acceptable

❌ **Başarısız Test Kriterleri:**
- JSON dosyası oluşturulmuyor
- Ayarlar persist edilmiyor
- Error'larda crash oluyor
- Komutlar çalışmıyor
- Performance sorunu var

## Otomatik Test Önerisi

Gelecekte aşağıdaki test framework'ü eklenebilir:

```typescript
// src/__tests__/accessiMindJsonManager.test.ts
describe('AccessiMindJsonManager', () => {
  test('should create default JSON file', async () => {
    // Test implementation
  });
  
  test('should persist wizard settings', async () => {
    // Test implementation  
  });
  
  test('should handle corrupted JSON gracefully', async () => {
    // Test implementation
  });
});
```

## Test Raporu Şablonu

```markdown
# Test Raporu - AccessiMind JSON Sistemi

**Test Tarihi:** [Tarih]
**Test Eden:** [İsim]
**Extension Version:** [Version]

## Test Sonuçları

| Senaryo | Durum | Notlar |
|---------|-------|--------|
| İlk Kurulum | ✅/❌ | |
| Wizard Tamamlama | ✅/❌ | |
| VS Code Restart | ✅/❌ | |
| Manuel JSON Edit | ✅/❌ | |
| Error Handling | ✅/❌ | |
| Komutlar | ✅/❌ | |
| Performance | ✅/❌ | |

## Bulunan Sorunlar

1. [Sorun açıklaması]
2. [Sorun açıklaması]

## Öneriler

1. [Öneri]
2. [Öneri]
```

## Monitoring ve Debugging

### Log Kontrolü
```bash
# VS Code Developer Tools'da console log'ları kontrol et
# Veya Output panel'de "AccessiMind" seçili iken log'ları takip et
```

### JSON Dosyası Monitoring
```bash
# JSON dosyasını real-time monitoring
tail -f accessimind.json
```

### Debug Mode
```bash
# VS Code debug mode'da extension'ı çalıştır
# F5 ile Extension Development Host başlat
```

Bu test rehberi ile AccessiMind JSON ayar sistemi kapsamlı şekilde test edilebilir ve güvenilirliği doğrulanabilir.