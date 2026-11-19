import { create } from 'zustand';

/**
 * Kod ekranına taşınan numara. Rota parametresi yerine bellekte tutulur:
 * web'de adres çubuğuna/geçmişe, native'de derin bağlantı loglarına kişisel veri düşmesin.
 */
type PendingPhoneState = { phone: string | null; setPhone: (phone: string | null) => void };

export const usePendingPhone = create<PendingPhoneState>((set) => ({
  phone: null,
  setPhone: (phone) => set({ phone }),
}));
