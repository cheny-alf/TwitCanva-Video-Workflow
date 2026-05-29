import React, { useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, Loader2, RefreshCw, Settings2, X } from 'lucide-react';
import {
    API_KEY_FIELDS,
    ApiKeyField,
    getApiKeyConfig,
    updateApiKeyConfig
} from '../../services/runtimeConfigService';

type StatusType = 'idle' | 'loading' | 'saving' | 'success' | 'error' | 'info';

interface ApiKeyConfigModalText {
    title: string;
    subtitle: string;
    keyConfigured: string;
    keyNotConfigured: string;
    maskedHintPrefix: string;
    noChanges: string;
    saveSuccess: string;
    saveFailedPrefix: string;
    loadFailedPrefix: string;
    cancel: string;
    save: string;
    saving: string;
    clear: string;
    paste: string;
    refresh: string;
    show: string;
    hide: string;
    scopeLabel: string;
    edited: string;
    clipboardDenied: string;
    loading: string;
}

interface ApiKeyConfigModalProps {
    isOpen: boolean;
    onClose: () => void;
    text: ApiKeyConfigModalText;
}

const buildEmptyRecord = <T extends string>(initialValue: string): Record<T, string> => {
    return Object.fromEntries(API_KEY_FIELDS.map(key => [key, initialValue])) as Record<T, string>;
};

export const ApiKeyConfigModal: React.FC<ApiKeyConfigModalProps> = ({
    isOpen,
    onClose,
    text
}) => {
    const [values, setValues] = useState<Record<ApiKeyField, string>>(buildEmptyRecord<ApiKeyField>(''));
    const [maskedValues, setMaskedValues] = useState<Record<ApiKeyField, string>>(buildEmptyRecord<ApiKeyField>(''));
    const [isSetMap, setIsSetMap] = useState<Record<ApiKeyField, boolean>>(
        Object.fromEntries(API_KEY_FIELDS.map(key => [key, false])) as Record<ApiKeyField, boolean>
    );
    const [showValueMap, setShowValueMap] = useState<Record<ApiKeyField, boolean>>(
        Object.fromEntries(API_KEY_FIELDS.map(key => [key, false])) as Record<ApiKeyField, boolean>
    );
    const [dirtyMap, setDirtyMap] = useState<Record<ApiKeyField, boolean>>(
        Object.fromEntries(API_KEY_FIELDS.map(key => [key, false])) as Record<ApiKeyField, boolean>
    );
    const [statusType, setStatusType] = useState<StatusType>('idle');
    const [statusMessage, setStatusMessage] = useState('');
    const [effectiveScope, setEffectiveScope] = useState<string[]>([]);

    const hasAnyChanges = useMemo(() => Object.values(dirtyMap).some(Boolean), [dirtyMap]);

    const resetDirty = () => {
        setDirtyMap(Object.fromEntries(API_KEY_FIELDS.map(key => [key, false])) as Record<ApiKeyField, boolean>);
    };

    const loadConfig = async () => {
        setStatusType('loading');
        setStatusMessage('');
        try {
            const result = await getApiKeyConfig();
            const nextMasked = buildEmptyRecord<ApiKeyField>('');
            const nextSetMap = Object.fromEntries(API_KEY_FIELDS.map(key => [key, false])) as Record<ApiKeyField, boolean>;

            for (const key of API_KEY_FIELDS) {
                const provider = result.providers?.[key];
                nextMasked[key] = provider?.maskedValue || '';
                nextSetMap[key] = !!provider?.isSet;
            }

            setMaskedValues(nextMasked);
            setIsSetMap(nextSetMap);
            setValues(buildEmptyRecord<ApiKeyField>(''));
            setShowValueMap(Object.fromEntries(API_KEY_FIELDS.map(key => [key, false])) as Record<ApiKeyField, boolean>);
            setEffectiveScope(result.effectiveScope || []);
            resetDirty();
            setStatusType('idle');
        } catch (error: any) {
            setStatusType('error');
            setStatusMessage(`${text.loadFailedPrefix}${error?.message || 'unknown error'}`);
        }
    };

    useEffect(() => {
        if (!isOpen) return;
        loadConfig();
    }, [isOpen]);

    if (!isOpen) return null;

    const updateValue = (key: ApiKeyField, value: string) => {
        setValues(prev => ({ ...prev, [key]: value }));
        setDirtyMap(prev => ({ ...prev, [key]: true }));
    };

    const handlePaste = async (key: ApiKeyField) => {
        try {
            const clipboardText = await navigator.clipboard.readText();
            updateValue(key, clipboardText);
            setStatusType('idle');
        } catch {
            setStatusType('error');
            setStatusMessage(`${text.saveFailedPrefix}${text.clipboardDenied}`);
        }
    };

    const handleSave = async () => {
        const updates = API_KEY_FIELDS.reduce((acc, key) => {
            if (dirtyMap[key]) {
                acc[key] = values[key];
            }
            return acc;
        }, {} as Partial<Record<ApiKeyField, string>>);

        if (Object.keys(updates).length === 0) {
            setStatusType('info');
            setStatusMessage(text.noChanges);
            return;
        }

        setStatusType('saving');
        setStatusMessage('');
        try {
            await updateApiKeyConfig(updates);
            await loadConfig();
            setStatusType('success');
            setStatusMessage(text.saveSuccess);
        } catch (error: any) {
            setStatusType('error');
            setStatusMessage(`${text.saveFailedPrefix}${error?.message || 'unknown error'}`);
        }
    };

    const statusColor = statusType === 'error'
        ? 'text-red-400'
        : statusType === 'success'
            ? 'text-green-400'
            : statusType === 'info'
                ? 'text-blue-400'
                : 'text-neutral-400';

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[120] flex items-center justify-center p-4">
            <div className="w-full max-w-3xl bg-[#121212] border border-neutral-700 rounded-2xl shadow-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-neutral-800 flex items-start justify-between">
                    <div>
                        <div className="flex items-center gap-2">
                            <Settings2 className="w-5 h-5 text-neutral-300" />
                            <h3 className="text-lg font-semibold text-white">{text.title}</h3>
                        </div>
                        <p className="text-sm text-neutral-400 mt-1">{text.subtitle}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-neutral-400 hover:text-white transition-colors"
                        aria-label="close"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="px-6 py-4 max-h-[65vh] overflow-y-auto">
                    <div className="flex items-center justify-between mb-4">
                        <div className={`text-xs ${statusColor}`}>
                            {statusType === 'loading' ? text.loading : statusMessage}
                        </div>
                        <button
                            onClick={loadConfig}
                            className="text-xs text-neutral-400 hover:text-white flex items-center gap-1 transition-colors"
                        >
                            <RefreshCw size={13} />
                            {text.refresh}
                        </button>
                    </div>

                    <div className="space-y-4">
                        {API_KEY_FIELDS.map((key) => {
                            const isVisible = showValueMap[key];
                            const isDirty = dirtyMap[key];
                            const currentValue = values[key];
                            const maskedValue = maskedValues[key];

                            return (
                                <div key={key} className="border border-neutral-800 rounded-xl p-4 bg-[#161616]">
                                    <div className="flex items-center justify-between mb-2">
                                        <div>
                                            <p className="text-sm font-medium text-white">{key}</p>
                                            <p className="text-xs text-neutral-400">
                                                {isSetMap[key] ? text.keyConfigured : text.keyNotConfigured}
                                            </p>
                                        </div>
                                        {isDirty && (
                                            <span className="text-[10px] px-2 py-1 rounded border border-blue-500/40 text-blue-300 bg-blue-500/10">
                                                {text.edited}
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <input
                                            type={isVisible ? 'text' : 'password'}
                                            value={currentValue}
                                            onChange={(e) => updateValue(key, e.target.value)}
                                            placeholder={maskedValue ? `${text.maskedHintPrefix}${maskedValue}` : text.keyNotConfigured}
                                            className="flex-1 bg-[#101010] border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                                        />
                                        <button
                                            onClick={() => setShowValueMap(prev => ({ ...prev, [key]: !prev[key] }))}
                                            className="px-2.5 py-2 rounded-lg border border-neutral-700 text-neutral-300 hover:text-white hover:border-neutral-500 transition-colors"
                                            title={isVisible ? text.hide : text.show}
                                        >
                                            {isVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                        <button
                                            onClick={() => updateValue(key, '')}
                                            className="px-3 py-2 rounded-lg border border-neutral-700 text-neutral-300 hover:text-white hover:border-neutral-500 text-xs transition-colors"
                                        >
                                            {text.clear}
                                        </button>
                                        <button
                                            onClick={() => handlePaste(key)}
                                            className="px-3 py-2 rounded-lg border border-neutral-700 text-neutral-300 hover:text-white hover:border-neutral-500 text-xs transition-colors"
                                        >
                                            {text.paste}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="mt-4 text-xs text-neutral-500">
                        {text.scopeLabel} {effectiveScope.length > 0 ? effectiveScope.join(', ') : '-'}
                    </div>
                </div>

                <div className="px-6 py-4 border-t border-neutral-800 flex items-center justify-between">
                    <div className="text-xs text-neutral-400">
                        {hasAnyChanges ? '' : text.noChanges}
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm rounded-lg border border-neutral-700 text-neutral-300 hover:text-white hover:border-neutral-500 transition-colors"
                        >
                            {text.cancel}
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={statusType === 'saving' || statusType === 'loading'}
                            className="px-4 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {(statusType === 'saving' || statusType === 'loading') && <Loader2 size={14} className="animate-spin" />}
                            {statusType === 'saving' ? text.saving : text.save}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
