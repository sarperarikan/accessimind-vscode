# Change Log

## [0.3.2] - 2025-01-02

### Removed
- Chat interface and all chat-related components
- Chat view providers (ChatViewProvider, ModernChatViewProvider)
- Chat message handling functionality
- AI provider selection interface from chat

### Modified
- DynamicPanelProvider updated with new action buttons:
  - "Mevcut kodu analiz et" (Analyze current code)
  - "Mevcut kodu iyileştir" (Improve current code)
- Simplified extension.ts without chat dependencies
- Updated package.json to remove chat views
- Enhanced accessibility with screen reader support and audio feedback

### Improved
- Focus on core accessibility improvement features
- Streamlined user interface for better accessibility
- Enhanced screen reader compatibility
- Better keyboard navigation support

### Technical Changes
- Removed chat-related imports and registrations
- Updated TabbedMainViewProvider to statistics-only mode
- Simplified provider architecture
- Cleaned up unused dependencies

---

## Previous Versions

### [0.3.1] - Previous Release
- Full chat interface functionality
- AI provider chat integration
- Chat view providers
- Message handling system

### [0.3.0] - Previous Release
- Initial chat interface implementation
- Basic WCAG improvement features
- Statistics tracking
- AI provider integration 