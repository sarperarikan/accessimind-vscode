/**
 * ai-provider.types.ts
 * Core contracts for the AI provider layer.
 * All providers depend on these types; no framework-specific imports allowed here.
 */
import * as vscode from "vscode";
import { PromptOptimizer } from "../../utils/apiOptimizer";

// ---------------------------------------------------------------------------
// Public DTOs
// ---------------------------------------------------------------------------

export interface AIResponse {
    success: boolean;
    content?: string;
    improvedCode?: string;
    summary?: string;
    wcagCriteria?: string[];
    error?: string;
    tokensUsed?: number;
    inputTokens?: number;
    outputTokens?: number;
    responseTime?: number;
    model?: string;
    provider: "gemini" | "vscode-copilot" | "ollama";
    usageMetadata?: Record<string, unknown>;
    cached?: boolean;
}

export interface WCAGRequest {
    code: string;
    fileType: string;
    language: string;
    selectedText?: string;
    wcagLevel?: "A" | "AA" | "AAA";
    includeComments?: boolean;
    responseLanguage?: "en" | "tr";
    forceRefresh?: boolean;
    mode?: "ask" | "agent" | "edit";
}

// ---------------------------------------------------------------------------
// Abstract Provider Base
// ---------------------------------------------------------------------------

export abstract class AIProvider {
    abstract improveCode(request: WCAGRequest): Promise<AIResponse>;
    abstract analyzeCode(request: WCAGRequest): Promise<AIResponse>;
    abstract isAvailable(): Promise<boolean>;
    abstract getDisplayName(): string;

    async chat(_message: string): Promise<AIResponse> {
        throw new Error("Chat not implemented for this provider.");
    }

    // -----------------------------------------------------------------------
    // Shared prompt builders (used by all concrete providers)
    // -----------------------------------------------------------------------

    protected buildWCAGPrompt(request: WCAGRequest): string {
        const {
            code,
            fileType,
            language,
            selectedText,
            wcagLevel = "AA",
            includeComments = true,
            responseLanguage = "en",
        } = request;

        const perf =
            (vscode.workspace
                .getConfiguration("wcagEnhancer")
                .get("performance") as Record<string, unknown>) || {};
        const fastMode = (perf?.fastMode as boolean) !== false;
        const maxChars =
            typeof perf?.promptMaxChars === "number" ? perf.promptMaxChars : 8000;

        const codeForPrompt = fastMode
            ? PromptOptimizer.truncateCode(
                PromptOptimizer.compressCode(code),
                maxChars
            )
            : code;
        const selectedForPrompt = selectedText
            ? fastMode
                ? PromptOptimizer.truncateCode(
                    PromptOptimizer.compressCode(selectedText),
                    Math.min(maxChars, 4000)
                )
                : selectedText
            : undefined;

        const strings = PROMPT_STRINGS[responseLanguage ?? "en"];
        const criteriaWithLevel = strings.criteria.replace(/%LEVEL%/g, wcagLevel);

        return `${strings.title}

${strings.primaryDirective}

${strings.fileType}: ${fileType}
${strings.language}: ${language}
${strings.wcagLevel}: ${wcagLevel}

${strings.forbidden}

${strings.allowed}

${selectedForPrompt
                ? `${strings.selectedCode}:\n\`\`\`${language}\n${selectedForPrompt}\n\`\`\`\n\n`
                : ""
            }${strings.currentCode}:
\`\`\`${language}
${codeForPrompt}
\`\`\`

${includeComments ? strings.comments : strings.noComments}

${strings.format}

${strings.fullStack.replace(/%LEVEL%/g, wcagLevel)}

${strings.zeroDefect}

${strings.cleanCode}

${strings.completeness}

${strings.interactiveOutput}

${criteriaWithLevel}`;
    }

    protected buildWCAGAnalysisPrompt(request: WCAGRequest): string {
        const { code, language, wcagLevel = "AA", responseLanguage = "en" } =
            request;

        const basePrompt =
            responseLanguage === "tr"
                ? `Lütfen aşağıdaki ${language} kodunu WCAG ${wcagLevel} standartlarına göre analiz edin:`
                : `Please analyze the following ${language} code according to WCAG ${wcagLevel} standards:`;

        const analysisInstructions =
            responseLanguage === "tr"
                ? `
Analiz sonucunda şunları sağlayın:
1. Genel erişilebilirlik skoru (0-100)
2. Tespit edilen erişilebilirlik sorunları
3. Her sorun için öneriler
4. WCAG uyum seviyesi (A, AA, AAA)
5. Kod kalitesi değerlendirmesi

Format: JSON formatında yanıt verin:
{
  "score": sayısal_skor,
  "level": "A|AA|AAA|Non-compliant",
  "issues": ["sorun1", "sorun2"],
  "suggestions": ["öneri1", "öneri2"],
  "summary": "kısa_özet"
}
`
                : `
Please provide:
1. Overall accessibility score (0-100)
2. Identified accessibility issues
3. Recommendations for each issue
4. WCAG conformance level (A, AA, AAA)
5. Code quality assessment

Format: Respond in JSON format:
{
  "score": numeric_score,
  "level": "A|AA|AAA|Non-compliant",
  "issues": ["issue1", "issue2"],
  "suggestions": ["suggestion1", "suggestion2"],
  "summary": "brief_summary"
}
`;

        return `${basePrompt}

${analysisInstructions}

\`\`\`${language}
${code}
\`\`\``;
    }

    protected extractWCAGCriteria(content: string): string[] {
        const criteria: string[] = [];
        const wcagPattern =
            /(?:WCAG|1\.\d+\.\d+|2\.\d+\.\d+|3\.\d+\.\d+|4\.\d+\.\d+)/gi;
        const matches = content.match(wcagPattern);
        if (matches) {
            criteria.push(...matches.map((m) => m.toUpperCase()));
        }

        const accessibilityFeatures = [
            "aria-label",
            "aria-describedby",
            "aria-labelledby",
            "aria-hidden",
            "alt",
            "title",
            "role",
            "tabindex",
            "focus",
            "keyboard",
            "contrast",
            "color",
            "semantic",
            "heading",
            "landmark",
        ];

        for (const feature of accessibilityFeatures) {
            if (content.toLowerCase().includes(feature)) {
                criteria.push(feature.toUpperCase());
            }
        }

        return [...new Set(criteria)];
    }
}

// ---------------------------------------------------------------------------
// Prompt string tables (extracted to keep base class lean)
// ---------------------------------------------------------------------------

interface PromptStrings {
    title: string;
    primaryDirective: string;
    fileType: string;
    language: string;
    wcagLevel: string;
    selectedCode: string;
    currentCode: string;
    forbidden: string;
    allowed: string;
    fullStack: string;
    format: string;
    criteria: string;
    comments: string;
    noComments: string;
    zeroDefect: string;
    cleanCode: string;
    completeness: string;
    // INTERACTIVE_OUTPUT_MANDATE:
    // Bu alan, AI'ın ürettiği kodun tarayıcıda gerçekten çalışır ve etkileşimli
    // olmasını zorunlu kılan sistem direktifini içerir. Tüm 3 provider (Gemini,
    // Copilot, Ollama) bu alanı buildWCAGPrompt üzerinden alır; böylece hangi
    // provider kullanılırsa kullanılsın çıktı kalitesi tutarlı kalır.
    interactiveOutput: string;
}

const PROMPT_STRINGS: Record<"en" | "tr", PromptStrings> = {
    en: {
        title: "You are a WCAG 2.2 accessibility expert.",
        primaryDirective:
            "YOUR PRIMARY DIRECTIVE: PRESERVE the existing code structure COMPLETELY. You must ONLY add accessibility improvements to the EXISTING elements. DO NOT rewrite, restructure, or recreate the code.",
        fileType: "File Type",
        language: "Language",
        wcagLevel: "WCAG Level",
        selectedCode: "Selected Code",
        currentCode: "Current Code",
        forbidden: `FORBIDDEN ACTIONS (violations will be rejected):
- DO NOT delete, rearrange, or replace existing elements
- DO NOT add new HTML sections, components, or visual elements
- DO NOT change class names, IDs, or existing attributes (unless fixing accessibility)
- DO NOT change the visual layout, styling, or design
- DO NOT remove or replace existing code logic
- DO NOT add new CSS styling beyond accessibility fixes (e.g. focus styles, contrast)
- DO NOT restructure the DOM hierarchy or code organization`,
        allowed: `ALLOWED ACTIONS (apply ONLY these):
- Add ARIA attributes (aria-label, aria-describedby, aria-live, etc.) to existing elements
- Add alt text to images that lack it
- Add lang attributes where missing
- Fix heading hierarchy (h1→h6) without changing content
- Add tabindex for keyboard navigation to interactive elements
- Add role attributes to existing elements
- Add form labels (associate existing labels or add aria-label)
- Add skip navigation links (minimal DOM addition)
- Add CSS :focus styles for keyboard visibility
- Fix color contrast values in existing CSS properties
- Add screen reader only text (.sr-only) where needed`,
        fullStack: `FULL-STACK WCAG IMPLEMENTATION (Based on selected WCAG %LEVEL% level):
Your improvements MUST produce a FULLY FUNCTIONAL accessibility implementation across ALL layers:

**HTML Layer:**
- Add semantic elements, ARIA attributes, roles, labels, and landmarks
- Ensure proper form associations (label[for], fieldset/legend)
- Add skip navigation links with matching anchor targets
- Ensure all interactive elements have accessible names

**CSS Layer:**
- Add :focus and :focus-visible styles with visible outlines for ALL interactive elements
- Add .sr-only utility class if used in HTML (position:absolute; clip; etc.)
- Fix color contrast ratios to meet WCAG %LEVEL% minimums (AA: 4.5:1 text, 3:1 large text; AAA: 7:1 text, 4.5:1 large text)
- Ensure text uses scalable units (rem/em instead of px)
- Add prefers-reduced-motion media query for animations
- Add prefers-contrast media query for high contrast mode support
- Ensure focus indicators are not hidden (no outline:none without replacement)

**JavaScript Layer:**
- Add keyboard event handlers (keydown/keyup) alongside click handlers
- Implement focus trapping for modals/dialogs (Tab and Shift+Tab cycling)
- Add aria-live region updates for dynamic content changes
- Implement Escape key handler to close overlays/modals
- Add proper focus management: move focus to new content, restore on close
- Ensure custom widgets follow WAI-ARIA Authoring Practices patterns

CRITICAL: Every HTML attribute you add (e.g. aria-describedby, .sr-only spans, skip links) MUST have its corresponding CSS and JS counterparts. Do NOT add attributes that reference non-existent styles or scripts.`,
        format: `Response format:
- Return ONLY the improved code, no explanations outside code
- Preserve ALL original formatting and indentation style
- Keep ALL existing class names, IDs, and attributes intact
- Specify applied WCAG criteria in inline comments`,
        criteria: `Focus on WCAG 2.2 Level %LEVEL% criteria:
- Perceivable (1.x): Text alternatives, contrast, adaptable content
- Operable (2.x): Keyboard access, focus management, navigation
- Understandable (3.x): Readability, predictability, input assistance
- Robust (4.x): ARIA compatibility, name/role/value, status messages`,
        comments: `MANDATORY DETAILED COMMENTS (in English):
For EVERY accessibility change, add a detailed inline comment that includes:
1. The exact WCAG criterion number (e.g. 1.1.1, 2.4.7, 4.1.2)
2. The criterion name (e.g. "Non-text Content", "Focus Visible", "Name, Role, Value")
3. The conformance level (A, AA, or AAA)
4. What was changed and WHY
5. The expected accessibility benefit

Comment format examples:
- HTML: <!-- WCAG 1.1.1 (Level A) Non-text Content: Added alt attribute to describe the hero image for screen readers -->
- CSS: /* WCAG 1.4.3 (Level AA) Contrast Minimum: Changed text color from #999 to #595959 to meet 4.5:1 contrast ratio against white background */
- JS: // WCAG 2.1.1 (Level A) Keyboard: Added keydown handler so Enter and Space keys activate this button, matching click behavior

Each comment MUST be inside the code. NEVER place explanations outside the code block.`,
        noComments:
            "Do NOT add explanatory comments. Only add the accessibility attributes silently.",
        zeroDefect: `ZERO-DEFECT MANDATE (Non-Negotiable):
- Output MUST render/compile without ANY errors in a clean environment
- Every aria-describedby, aria-labelledby, aria-controls MUST reference an existing element ID
- Every .sr-only class usage MUST have a corresponding CSS definition in the output
- Every skip-link href MUST have a matching anchor target in the document
- Every id attribute MUST be unique within the document
- No orphaned CSS selectors referencing non-existent classes or IDs
- No undefined JS variables, functions, or DOM references
- No broken event listeners referencing elements that do not exist
- If you add an aria-live region in HTML, you MUST add the JS code that updates it
- Self-validate: before returning, mentally verify every cross-reference is intact`,
        cleanCode: `CLEAN CODE PRINCIPLES (Mandatory):
- Match the original code's indentation style exactly (tabs vs spaces, indent width)
- No duplicate event handlers or redundant ARIA attributes
- DRY: if a pattern repeats 3+ times, extract into a reusable function
- Use descriptive, self-documenting variable and function names
- No dead code, no unused variables, no empty blocks
- Group related accessibility additions together (e.g., all ARIA attrs on one element adjacent)
- Keep function bodies focused and short — one responsibility per function`,
        completeness: `COMPLETENESS GUARANTEE (Critical):
- Return the COMPLETE file content from first line to last line
- Include ALL original code PLUS all accessibility improvements
- NEVER truncate, abbreviate, or omit any part of the code
- NEVER use placeholders like "...", "// rest of code", "/* remaining code */", or "// (same as before)"
- NEVER say "continue from here" or "no changes needed for this section"
- Even if code is long, return EVERY SINGLE LINE
- The output must be a drop-in replacement for the original file`,

        // INTERACTIVE_OUTPUT_MANDATE (EN):
        // Neden bu direktif var?
        // AccessiMind'ın "Show in Browser" özelliği AI çıktısını doğrudan bir
        // geçici HTML dosyasına yazar ve tarayıcıda açar. Eğer AI yalnızca HTML
        // üretip CSS/JS'yi eksik bırakırsa, önizleme kırık görünür ve
        // erişilebilirlik iyileştirmeleri test edilemez. Bu direktif, üç
        // provider'ın (Gemini, Copilot, Ollama) tamamının self-contained,
        // tarayıcıda çalışır çıktı üretmesini garanti eder.
        interactiveOutput: `INTERACTIVE & BROWSER-READY OUTPUT MANDATE (Non-Negotiable for ALL Providers):

The output you produce MUST be a fully interactive, self-contained, browser-executable file.
This is required because AccessiMind's "Show in Browser" feature writes your output directly
to a temporary file and opens it in the user's default browser for live preview and testing.
If your output is broken, incomplete, or non-functional, the accessibility improvements
cannot be visually verified or tested by the user.

// WHY THIS IS MANDATORY:
// 1. The browser preview is the primary QA mechanism for WCAG compliance verification.
// 2. Screen reader testing requires a fully rendered, interactive DOM — not a partial snippet.
// 3. Keyboard navigation testing (Tab order, focus traps, skip links) only works in a live browser.
// 4. Color contrast and visual focus indicators can only be verified in a rendered page.
// 5. ARIA live regions and dynamic announcements require JavaScript to be present and executing.

HTML REQUIREMENTS:
- The file MUST start with <!DOCTYPE html> and include <html lang="..."> with correct lang attribute
- MUST include <head> with <meta charset="UTF-8">, <meta name="viewport">, and <title>
- ALL CSS must be embedded in a <style> block inside <head> (no external stylesheets)
- ALL JavaScript must be embedded in a <script> block before </body> (no external scripts)
- The page MUST render correctly when opened as a local file (file:// protocol, no server needed)
- NO references to external CDNs, fonts, or resources that require internet access

CSS REQUIREMENTS:
- ALL styles must be self-contained within <style> tags — no @import, no external URLs
- :focus and :focus-visible styles MUST be present and visually distinct (min 3px outline)
- .sr-only class MUST be defined if used anywhere in the HTML
- Color contrast MUST meet WCAG minimums verifiable in the rendered page
- prefers-reduced-motion and prefers-contrast media queries MUST be included

JAVASCRIPT REQUIREMENTS:
- ALL scripts must be self-contained within <script> tags — no external imports
- Scripts MUST use DOMContentLoaded or be placed at end of <body> to ensure DOM is ready
- ALL event listeners MUST be attached to elements that exist in the HTML output
- NO undefined variables, NO broken DOM references, NO console errors on page load
- Keyboard handlers (Enter, Space, Escape, Tab) MUST be implemented for ALL interactive elements
- Focus management MUST work: modals trap focus, closing restores focus to trigger element
- aria-live regions MUST be updated by JavaScript when dynamic content changes

SELF-VALIDATION CHECKLIST (perform before returning output):
□ Does the file open without errors in a browser?
□ Can ALL interactive elements be reached and activated by keyboard alone?
□ Do ALL ARIA attributes reference existing element IDs?
□ Is the .sr-only class defined in CSS if used in HTML?
□ Do ALL skip links point to existing anchor targets?
□ Are ALL JavaScript event listeners attached to elements present in the HTML?
□ Does the page work offline (no external dependencies)?
□ Are ALL IDs unique within the document?
□ Do focus indicators appear on ALL focusable elements?
□ Do aria-live regions update correctly when triggered?`,
    },
    tr: {
        title: "Sen bir WCAG 2.2 erişilebilirlik uzmanısın.",
        primaryDirective:
            "BİRİNCİL DİREKTİFİN: Mevcut kod yapısını TAMAMEN KORU. SADECE mevcut elementlere erişilebilirlik iyileştirmeleri ekle. Kodu yeniden yazma, yapılandırma veya yeniden oluşturma.",
        fileType: "Dosya Türü",
        language: "Dil",
        wcagLevel: "WCAG Seviyesi",
        selectedCode: "Seçili Kod",
        currentCode: "Mevcut Kod",
        forbidden: `YASAK İŞLEMLER (ihlaller reddedilecektir):
- Mevcut elementleri SİLME, yeniden düzenleme veya değiştirme
- Yeni HTML bölümleri, bileşenler veya görsel elemanlar EKLEME
- Sınıf adlarını, ID'leri veya mevcut nitelikleri DEĞİŞTİRME (erişilebilirlik düzeltmesi hariç)
- Görsel düzeni, stili veya tasarımı DEĞİŞTİRME
- Mevcut kod mantığını kaldırma veya değiştirme
- Erişilebilirlik düzeltmeleri dışında yeni CSS stili EKLEME
- DOM hiyerarşisini veya kod organizasyonunu yeniden yapılandırma`,
        allowed: `İZİN VERİLEN İŞLEMLER (SADECE bunları uygula):
- Mevcut elementlere ARIA nitelikleri (aria-label, aria-describedby, aria-live, vb.) ekle
- Alt metni olmayan resimlere alt text ekle
- Eksik lang niteliklerini ekle
- İçeriği değiştirmeden başlık hiyerarşisini düzelt (h1→h6)
- Etkileşimli elementlere tabindex ekle
- Mevcut elementlere role nitelikleri ekle
- Form etiketleri ekle (mevcut etiketleri ilişkilendir veya aria-label ekle)
- Atlama bağlantıları ekle (minimum DOM eklentisi)
- Klavye görünürlüğü için CSS :focus stilleri ekle
- Mevcut CSS özelliklerinde renk kontrastı değerlerini düzelt
- Gerekli yerlerde ekran okuyucu metni (.sr-only) ekle`,
        fullStack: `TAM KATMANLI WCAG UYGULAMASI (Seçilen WCAG %LEVEL% seviyesine göre):
İyileştirmeleriniz TÜM katmanlarda TAM İŞLEVSEL bir erişilebilirlik uygulaması üretmelidir:

**HTML Katmanı:**
- Semantik elementler, ARIA nitelikleri, roller, etiketler ve landmark'lar ekle
- Form ilişkilendirmelerini düzelt (label[for], fieldset/legend)
- Eşleşen hedeflerle atlama bağlantıları ekle
- Tüm etkileşimli elementlerin erişilebilir adları olsun

**CSS Katmanı:**
- TÜM etkileşimli elementlere görünür :focus ve :focus-visible stilleri ekle
- HTML'de kullanılan .sr-only sınıfı için CSS tanımı ekle (position:absolute; clip; vb.)
- Renk kontrastını WCAG %LEVEL% minimumlarına getir (AA: 4.5:1 metin, 3:1 büyük metin; AAA: 7:1 metin, 4.5:1 büyük metin)
- Metin ölçeklenebilir birimler kullansın (px yerine rem/em)
- Animasyonlar için prefers-reduced-motion media query ekle
- Yüksek kontrast modu için prefers-contrast media query ekle
- Odak göstergeleri gizlenmesin (yerine koyulmadan outline:none kullanma)

**JavaScript Katmanı:**
- Click handler'ların yanına klavye event handler'ları (keydown/keyup) ekle
- Modal/dialog'lar için focus trapping uygula (Tab ve Shift+Tab döngüsü)
- Dinamik içerik değişiklikleri için aria-live bölge güncellemeleri ekle
- Overlay/modal kapatmak için Escape tuşu handler'ı ekle
- Odak yönetimi uygula: yeni içeriğe odakla, kapanınca geri yükle
- Özel widget'lar WAI-ARIA Authoring Practices kalıplarını takip etsin

KRİTİK: Eklediğin her HTML niteliğinin (ör: aria-describedby, .sr-only span'lar, atlama bağlantıları) karşılık gelen CSS ve JS tarafı da OLMALIDIR. Var olmayan stil veya script'lere referans veren nitelikler EKLEME.`,
        format: `Yanıt formatı:
- SADECE iyileştirilmiş kodu döndür, kod dışında açıklama yapma
- TÜM orijinal biçimlendirmeyi ve girinti stilini koru
- TÜM mevcut sınıf adlarını, ID'leri ve nitelikleri olduğu gibi bırak
- Uygulanan WCAG kriterlerini satır içi yorumlarda belirt`,
        criteria: `WCAG 2.2 Seviye %LEVEL% kriterlerine odaklan:
- Algılanabilir (1.x): Metin alternatifleri, kontrast, uyarlanabilir içerik
- İşletilebilir (2.x): Klavye erişimi, odak yönetimi, navigasyon
- Anlaşılabilir (3.x): Okunabilirlik, öngörülebilirlik, girdi yardımı
- Sağlam (4.x): ARIA uyumu, ad/rol/değer, durum mesajları`,
        comments: `ZORUNLU DETAYLI YORUMLAR (Türkçe olarak):
Yaptığın HER erişilebilirlik değişikliği için aşağıdakileri içeren detaylı bir satır içi yorum ekle:
1. Tam WCAG kriter numarası (ör: 1.1.1, 2.4.7, 4.1.2)
2. Kriter adı (ör: "Metin Dışı İçerik", "Odak Görünür", "Ad, Rol, Değer")
3. Uygunluk seviyesi (A, AA veya AAA)
4. Ne değiştirildi ve NEDEN
5. Beklenen erişilebilirlik faydası

Yorum format örnekleri:
- HTML: <!-- WCAG 1.1.1 (Seviye A) Metin Dışı İçerik: Hero resmi için ekran okuyuculara açıklama sağlamak üzere alt niteliği eklendi -->
- CSS: /* WCAG 1.4.3 (Seviye AA) Minimum Kontrast: Beyaz arka plana karşı 4.5:1 kontrast oranını sağlamak için metin rengi #999'dan #595959'a değiştirildi */
- JS: // WCAG 2.1.1 (Seviye A) Klavye: Enter ve Space tuşlarının bu butonu tıklama davranışıyla aynı şekilde etkinleştirmesi için keydown handler eklendi

Her yorum kodun İÇİNDE olmalıdır. Açıklamaları ASLA kod bloğunun dışına KOYMA.`,
        noComments:
            "Açıklayıcı yorum EKLEME. Sadece erişilebilirlik niteliklerini sessizce ekle.",
        zeroDefect: `SIFIR HATA ZORUNLULUĞU (Pazarlık Edilemez):
- Çıktı temiz bir ortamda HİÇBİR hata olmadan render/derlenmeli
- Her aria-describedby, aria-labelledby, aria-controls mevcut bir element ID'sine referans vermeli
- Her .sr-only sınıf kullanımının çıktıda karşılık gelen CSS tanımı OLMALI
- Her skip-link href'inin dokümanda eşleşen bir hedef çapası OLMALI
- Her id niteliği dokümanda benzersiz OLMALI
- Var olmayan sınıf veya ID'lere referans veren yetim CSS seçiciler OLMAMALI
- Tanımsız JS değişkenleri, fonksiyonları veya DOM referansları OLMAMALI
- Var olmayan elementlere referans veren kırık olay dinleyicileri OLMAMALI
- HTML'de aria-live bölge eklersen, onu güncelleyen JS kodunu da EKLEMELISIN
- Öz-doğrulama: döndürmeden önce her çapraz referansın sağlam olduğunu zihinsel olarak doğrula`,
        cleanCode: `TEMİZ KOD İLKELERİ (Zorunlu):
- Orijinal kodun girinti stilini tam olarak eşle (tab vs boşluk, girinti genişliği)
- Tekrarlanan olay işleyicileri veya gereksiz ARIA nitelikleri OLMAMALI
- DRY: bir kalıp 3+ kez tekrarlanıyorsa yeniden kullanılabilir bir fonksiyona çıkar
- Açıklayıcı, kendi kendini belgeleyen değişken ve fonksiyon adları kullan
- Ölü kod, kullanılmayan değişkenler, boş bloklar OLMAMALI
- İlişkili erişilebilirlik eklemelerini bir arada grupla
- Fonksiyon gövdelerini odaklı ve kısa tut — fonksiyon başına tek sorumluluk`,
        completeness: `BÜTÜNLÜK GARANTİSİ (Kritik):
- Dosya içeriğini ilk satırdan son satıra kadar TAMAMEN döndür
- TÜM orijinal kodu ARTI tüm erişilebilirlik iyileştirmelerini dahil et
- Kodun hiçbir bölümünü ASLA kısaltma, özetleme veya çıkarma
- ASLA "...", "// kodun geri kalanı", "/* kalan kod */" veya "// (öncekiyle aynı)" gibi yer tutucular KULLANMA
- ASLA "buradan devam et" veya "bu bölüm için değişiklik gerekmiyor" DEME
- Kod uzun olsa bile HER TEK SATIRI döndür
- Çıktı orijinal dosyanın birebir yerine geçebilecek olmalı`,

        // INTERACTIVE_OUTPUT_MANDATE (TR):
        // Neden bu direktif var?
        // AccessiMind'ın "Tarayıcıda Göster" özelliği, AI çıktısını doğrudan
        // geçici bir HTML dosyasına yazar ve kullanıcının varsayılan tarayıcısında
        // açar. Eğer AI yalnızca HTML üretip CSS/JS'yi eksik bırakırsa, önizleme
        // kırık görünür ve erişilebilirlik iyileştirmeleri test edilemez hale gelir.
        // Bu direktif, üç provider'ın (Gemini, Copilot, Ollama) tamamının
        // self-contained, tarayıcıda çalışır çıktı üretmesini garanti eder.
        interactiveOutput: `ETKİLEŞİMLİ VE TARAYICI HAZIR ÇIKTI ZORUNLULUĞU (Tüm Provider'lar İçin Pazarlık Edilemez):

Ürettiğin çıktı, tam anlamıyla etkileşimli, self-contained ve tarayıcıda çalışabilir bir dosya OLMALIDIR.
Bu zorunludur çünkü AccessiMind'ın "Tarayıcıda Göster" özelliği, çıktını doğrudan geçici bir dosyaya
yazar ve kullanıcının varsayılan tarayıcısında açar. Çıktın kırık, eksik veya işlevsizse,
erişilebilirlik iyileştirmeleri görsel olarak doğrulanamaz veya test edilemez.

// NEDEN ZORUNLU:
// 1. Tarayıcı önizlemesi, WCAG uyumluluğunu doğrulamak için birincil QA mekanizmasıdır.
// 2. Ekran okuyucu testi, tam render edilmiş, etkileşimli bir DOM gerektirir — kısmi snippet değil.
// 3. Klavye navigasyon testi (Tab sırası, focus trap'ler, atlama bağlantıları) yalnızca canlı tarayıcıda çalışır.
// 4. Renk kontrastı ve görsel odak göstergeleri yalnızca render edilmiş sayfada doğrulanabilir.
// 5. ARIA live bölgeleri ve dinamik duyurular, JavaScript'in mevcut ve çalışıyor olmasını gerektirir.

HTML GEREKSİNİMLERİ:
- Dosya <!DOCTYPE html> ile başlamalı ve doğru lang niteliğiyle <html lang="..."> içermeli
- <head> içinde <meta charset="UTF-8">, <meta name="viewport"> ve <title> OLMALI
- TÜM CSS, <head> içindeki <style> bloğuna gömülmeli (harici stylesheet yok)
- TÜM JavaScript, </body>'den önce <script> bloğuna gömülmeli (harici script yok)
- Sayfa yerel dosya olarak açıldığında doğru render edilmeli (file:// protokolü, sunucu gerekmez)
- İnternet erişimi gerektiren harici CDN, font veya kaynaklara REFERANS VERİLMEMELİ

CSS GEREKSİNİMLERİ:
- TÜM stiller <style> etiketleri içinde self-contained olmalı — @import veya harici URL yok
- :focus ve :focus-visible stilleri görsel olarak belirgin OLMALI (min 3px outline)
- HTML'de kullanılıyorsa .sr-only sınıfı TANIMLANMALI
- Renk kontrastı render edilmiş sayfada doğrulanabilir WCAG minimumlarını karşılamalı
- prefers-reduced-motion ve prefers-contrast media query'leri OLMALI

JAVASCRIPT GEREKSİNİMLERİ:
- TÜM scriptler <script> etiketleri içinde self-contained olmalı — harici import yok
- Scriptler DOMContentLoaded kullanmalı veya <body> sonuna yerleştirilmeli
- TÜM event listener'lar HTML çıktısında var olan elementlere bağlanmalı
- Tanımsız değişken, kırık DOM referansı, sayfa yüklenirken console hatası OLMAMALI
- Klavye handler'ları (Enter, Space, Escape, Tab) TÜM etkileşimli elementler için OLMALI
- Odak yönetimi çalışmalı: modal'lar odağı yakalar, kapanınca tetikleyici elemente geri döner
- aria-live bölgeleri, dinamik içerik değiştiğinde JavaScript tarafından güncellenmeli

ÖZ-DOĞRULAMA KONTROLLİSTESİ (çıktıyı döndürmeden önce uygula):
□ Dosya tarayıcıda hatasız açılıyor mu?
□ TÜM etkileşimli elementlere yalnızca klavye ile ulaşılabiliyor ve etkinleştirilebiliyor mu?
□ TÜM ARIA nitelikleri mevcut element ID'lerine referans veriyor mu?
□ HTML'de kullanılıyorsa .sr-only sınıfı CSS'de tanımlı mı?
□ TÜM atlama bağlantıları mevcut hedef çapalara işaret ediyor mu?
□ TÜM JavaScript event listener'ları HTML'de mevcut elementlere bağlı mı?
□ Sayfa çevrimdışı çalışıyor mu (harici bağımlılık yok)?
□ Dokümanda TÜM ID'ler benzersiz mi?
□ TÜM odaklanabilir elementlerde odak göstergeleri görünüyor mu?
□ aria-live bölgeleri tetiklendiğinde doğru güncelleniyor mu?`,
    },
};
