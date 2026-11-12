"use client";
import { useLocale } from "@/components/locale-provider";
import { SETTINGS_UI } from "@/lib/i18n/messages/settings-sections";

export type SettingsText = (typeof SETTINGS_UI)["de"];

/** Texte der Einstellungen in der gewählten Sprache */
export const useT = (): SettingsText => SETTINGS_UI[useLocale()];

export const msg = (e: unknown, t: SettingsText) => (e instanceof Error ? e.message : t.error);

/** Eintrag einer Liste innerhalb einer Einstellungszeile */
export const itemCls = "rounded-[8px] bg-paper-2 flex items-center justify-between gap-4 pl-4 pr-2 py-2.5 min-h-[60px]";
export const listCls = "space-y-2 mb-5";
