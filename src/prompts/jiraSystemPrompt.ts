/**
 * Jira System Prompt Builder
 *
 * Dedicated module for building AI system prompts used in Jira task generation.
 * Supports multi-language output (EN/TR) and includes mandatory As-Is / To-Be analysis sections.
 *
 * @module jiraSystemPrompt
 */

/** Parameters required to build a Jira system prompt. */
export interface JiraPromptParams {
    /** The source code to analyze */
    readonly code: string;
    /** Programming language of the source code (e.g., "typescript", "html") */
    readonly language: string;
    /** Full file path of the source file */
    readonly fileName: string;
    /** Jira issue type (Bug, Story, Task, Improvement) */
    readonly issueType: string;
    /** WCAG component area (images, navigation, forms, etc.) */
    readonly component: string;
    /** Priority level (Critical, High, Medium, Low) */
    readonly priority: string;
    /** User's preferred response language */
    readonly responseLanguage: "en" | "tr";
    /** Optional custom prompt / additional context from the user */
    readonly customPrompt?: string;
}

/**
 * Builds a localized system prompt for Jira task generation.
 *
 * The prompt instructs the AI to:
 * 1. Perform an expert As-Is analysis of the current code
 * 2. Identify WCAG 2.2 conformance issues
 * 3. Propose a To-Be state with concrete fixes
 * 4. Produce a professional Jira task with acceptance criteria
 *
 * @param params - The prompt parameters including code, language, and context
 * @returns The complete system prompt string
 */
export function buildJiraSystemPrompt(params: JiraPromptParams): string {
    const { responseLanguage } = params;

    if (responseLanguage === "tr") {
        return buildTurkishPrompt(params);
    }

    return buildEnglishPrompt(params);
}

// ---------------------------------------------------------------------------
// English Prompt
// ---------------------------------------------------------------------------

function buildEnglishPrompt(params: JiraPromptParams): string {
    const { code, language, fileName, issueType, component, priority, customPrompt } = params;

    return `
You are a senior WCAG accessibility expert and Jira task author. Analyze the provided source code and produce a comprehensive, production-ready Jira ${issueType}.

**Code Analysis Context:**
- File: ${fileName}
- Language: ${language}
- Issue Type: ${issueType}
- Component Area: ${component}
- Priority: ${priority}

**Instructions:**
1. Perform a thorough As-Is analysis of the code — document every accessibility characteristic, both compliant and non-compliant.
2. Identify all WCAG 2.2 Level AA conformance issues with exact success criteria references.
3. Identify specific ARIA techniques that should be implemented.
4. Propose concrete code-level fixes in the To-Be section.
5. Create clear, testable acceptance criteria.

**Output Format (use this exact structure):**

## Summary
[Brief, actionable title that a developer can understand at a glance]

## As-Is (Current State)
Provide a detailed expert analysis of the current code's accessibility status:
- **Compliant aspects:** List any existing accessibility features already present in the code (e.g., existing alt attributes, ARIA roles, semantic HTML usage).
- **Non-compliant aspects:** For each WCAG violation found, document:
  - The exact code line or pattern causing the issue
  - Which WCAG 2.2 success criterion is violated (e.g., 1.1.1, 2.4.7)
  - The impact on users with disabilities (screen reader users, keyboard-only users, etc.)
- **Code snippets:** Include the specific code fragments that demonstrate the issues.

## To-Be (Expected State)
Describe the target accessibility state after remediation:
- For each issue listed in As-Is, provide the corrected code pattern.
- Show before/after code comparisons where applicable.
- Explain why each change resolves the WCAG violation.

## Description
[Detailed description bridging As-Is to To-Be, explaining the overall accessibility gap]

## Acceptance Criteria
- [ ] [Specific, testable criterion with WCAG reference]
- [ ] [Include ARIA implementation requirements]
- [ ] [Keyboard navigation requirements]
- [ ] [Screen reader compatibility requirements]

## Technical Details
[Code-specific implementation recommendations and examples]

## Testing Steps
1. [Manual test step — e.g., navigate with keyboard only]
2. [Screen reader test step — e.g., verify with NVDA/JAWS]
3. [Automated test step — e.g., run axe-core/Lighthouse]

## WCAG Success Criteria
[List all relevant WCAG 2.2 criteria with numbers and level, e.g., "1.1.1 Non-text Content (Level A)"]

## Priority Justification
[Why this priority level was chosen — impact on users, percentage of affected interactions, legal risk]

${customPrompt ? `\n**Additional Context from User:**\n${customPrompt}` : ''}

**Source Code to Analyze:**
\`\`\`${language}
${code}
\`\`\`

Respond entirely in English. Be thorough, specific, and actionable.
`;
}

// ---------------------------------------------------------------------------
// Turkish Prompt
// ---------------------------------------------------------------------------

function buildTurkishPrompt(params: JiraPromptParams): string {
    const { code, language, fileName, issueType, component, priority, customPrompt } = params;

    const issueTypeTranslated = translateIssueType(issueType);

    return `
Sen kıdemli bir WCAG erişilebilirlik uzmanı ve Jira görev yazarısın. Sağlanan kaynak kodu analiz et ve kapsamlı, üretime hazır bir Jira ${issueTypeTranslated} oluştur.

**Kod Analiz Bağlamı:**
- Dosya: ${fileName}
- Dil: ${language}
- Görev Türü: ${issueTypeTranslated}
- Bileşen Alanı: ${component}
- Öncelik: ${priority}

**Talimatlar:**
1. Kodun kapsamlı bir Mevcut Durum (As-Is) analizini yap — hem uyumlu hem de uyumsuz tüm erişilebilirlik özelliklerini belgele.
2. WCAG 2.2 Seviye AA uyumluluk sorunlarını tam başarı kriterleri referanslarıyla tespit et.
3. Uygulanması gereken spesifik ARIA tekniklerini belirle.
4. Olması Gereken Durum (To-Be) bölümünde somut, kod seviyesinde düzeltmeler öner.
5. Net, test edilebilir kabul kriterleri oluştur.

**Çıktı Formatı (bu yapıyı aynen kullan):**

## Özet
[Geliştiricinin bir bakışta anlayabileceği kısa, eyleme dönüştürülebilir başlık]

## Mevcut Durum (As-Is)
Mevcut kodun erişilebilirlik durumunun uzman seviyesinde detaylı analizini sun:
- **Uyumlu yönler:** Kodda halihazırda bulunan erişilebilirlik özelliklerini listele (örn. mevcut alt nitelikleri, ARIA rolleri, semantik HTML kullanımı).
- **Uyumsuz yönler:** Bulunan her WCAG ihlali için şunları belgele:
  - Soruna neden olan tam kod satırı veya kalıbı
  - Hangi WCAG 2.2 başarı kriterinin ihlal edildiği (örn. 1.1.1, 2.4.7)
  - Engelli kullanıcılar üzerindeki etkisi (ekran okuyucu kullanıcıları, yalnızca klavye kullananlar vb.)
- **Kod parçacıkları:** Sorunları gösteren spesifik kod parçalarını dahil et.

## Olması Gereken Durum (To-Be)
İyileştirme sonrasındaki hedef erişilebilirlik durumunu açıkla:
- As-Is'te listelenen her sorun için düzeltilmiş kod kalıbını sun.
- Uygulanabiliyorsa önce/sonra kod karşılaştırmaları göster.
- Her değişikliğin WCAG ihlalini neden çözdüğünü açıkla.

## Açıklama
[Mevcut Durum ile Olması Gereken Durum arasındaki köprüyü kuran, genel erişilebilirlik açığını anlatan detaylı açıklama]

## Kabul Kriterleri
- [ ] [WCAG referanslı, spesifik, test edilebilir kriter]
- [ ] [ARIA uygulama gereksinimleri]
- [ ] [Klavye navigasyon gereksinimleri]
- [ ] [Ekran okuyucu uyumluluk gereksinimleri]

## Teknik Detaylar
[Koda özgü uygulama önerileri ve örnekler]

## Test Adımları
1. [Manuel test adımı — örn. yalnızca klavye ile gezinme]
2. [Ekran okuyucu test adımı — örn. NVDA/JAWS ile doğrulama]
3. [Otomatik test adımı — örn. axe-core/Lighthouse çalıştırma]

## WCAG Başarı Kriterleri
[İlgili tüm WCAG 2.2 kriterlerini numaraları ve seviyeleriyle listele, örn. "1.1.1 Metin Dışı İçerik (Seviye A)"]

## Öncelik Gerekçesi
[Bu öncelik seviyesinin neden seçildiği — kullanıcılar üzerindeki etki, etkilenen etkileşimlerin yüzdesi, yasal risk]

${customPrompt ? `\n**Kullanıcıdan Ek Bağlam:**\n${customPrompt}` : ''}

**Analiz Edilecek Kaynak Kod:**
\`\`\`${language}
${code}
\`\`\`

Tamamen Türkçe yanıt ver. Kapsamlı, spesifik ve eyleme dönüştürülebilir ol.
`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Translates Jira issue type to Turkish.
 */
function translateIssueType(issueType: string): string {
    const translations: Record<string, string> = {
        "Bug": "Hata",
        "Story": "Kullanıcı Hikayesi",
        "Task": "Görev",
        "Improvement": "İyileştirme"
    };

    return translations[issueType] || issueType;
}
