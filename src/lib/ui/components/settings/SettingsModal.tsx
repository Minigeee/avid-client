import { KeyboardEvent, PropsWithChildren, RefObject, createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { Affix, Button, CloseButton, Flex, Group, ScrollArea, Stack, Text, Title, Transition } from '@mantine/core';
import { UseFormReturnType } from '@mantine/form';

import { IconAlertCircle } from '@tabler/icons-react';
import SettingsMenu from './SettingsMenu';
import { cache, useCachedState } from '@/lib/hooks';

import { merge } from 'lodash';


/** Unsaved changes context */
// @ts-ignore
const SettingsModalContext = createContext<{
  bodyRef: RefObject<HTMLDivElement>;
  hasUnsavedChanges: boolean;
  setHasUnsavedChanges: (value: boolean) => void;
  highlightUnsaved: boolean;
  tab: string;
}>();

////////////////////////////////////////////////////////////
export type SettingsModalProps = PropsWithChildren & {
  /** Key of menu, used to cache navigation state */
  navkey: string;
  /** A map of tabs to display in settings menu, grouped by section */
  tabs: Record<string, {
    value: string;
    label: string;
    link?: string;
  }[]>;
  /** Tab that should be started on */
  defaultTab?: string;

  /** Function that will be called to close modal */
  close: () => void;
};

////////////////////////////////////////////////////////////
export function SettingsModal(props: SettingsModalProps) {
  const bodyRef = useRef<HTMLDivElement>(null);

  // Tracks if there are unsaved changes
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  // Indicates if unsaved notifier should be highlighted
  const [highlightUnsaved, setHighlightUnsaved] = useState<boolean>(false);

  // Flattened list of tabs
  const flattenedTabs = useMemo(() => {
    let flattened: { value: string; label: string }[] = [];
    for (const tabs of Object.values(props.tabs))
      flattened.push(...tabs);
    return flattened;
  }, [props.tabs]);

  // Current tab
  const initialTab = useMemo(() => {
    const tabId = props.defaultTab;
    return tabId ? flattenedTabs.find(x => x.value === tabId) || flattenedTabs[0] : flattenedTabs[0];
  }, [flattenedTabs, props.defaultTab]);
  const [tab, setTab] = useCachedState<{ value: string; label: string }>(`settings.${props.navkey}.tab`, initialTab, props.defaultTab ? initialTab : undefined);

  
  // Close handlers
  useEffect(() => {
    // Reset highlight
    if (!hasUnsavedChanges && highlightUnsaved)
      setHighlightUnsaved(false);

    function close() {
      if (hasUnsavedChanges)
        setHighlightUnsaved(true);
      else
        props.close();
    }

    function onKeyEvent(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
    }

    window.addEventListener('mousedown', close);
    // @ts-ignore
    window.addEventListener('keydown', onKeyEvent);

    return () => {
      window.removeEventListener('mousedown', close);
      // @ts-ignore
      window.removeEventListener('keydown', onKeyEvent);
    }
  }, [hasUnsavedChanges, cache[`settings.${props.navkey}.unsaved`]]);


  return (
    <SettingsModalContext.Provider value={{
      bodyRef,
      hasUnsavedChanges,
      setHasUnsavedChanges,
      highlightUnsaved,
      tab: tab.value,
    }}>
      <Flex ref={bodyRef} w='100%' h='100%' onMouseDown={(e) => e.stopPropagation()}>
        <SettingsMenu
          values={props.tabs}
          value={tab?.value || ''}
          onChange={(value, label) => {
            if (hasUnsavedChanges)
              setHighlightUnsaved(true);
            else
              setTab({ label, value })
          }}
          scrollAreaProps={{
            w: '30ch',
            pt: 10,
            sx: (theme) => ({ backgroundColor: theme.colors.dark[6] }),
          }}
        />

        <Flex h='100%' direction='column' sx={(theme) => ({
          flexGrow: 1,
          backgroundColor: theme.colors.dark[7],
        })}>
          <Flex align='end' mb={4} sx={(theme) => ({
            padding: '1.0rem 1.5rem',
            borderBottom: `1px solid ${theme.colors.dark[5]}`,
          })}>
            <Title order={2}>{tab?.label}</Title>
            <div style={{ flexGrow: 1 }} />
            <CloseButton
              size='lg'
              iconSize={24}
              onClick={() => {
                if (hasUnsavedChanges)
                  setHighlightUnsaved(true);
                else
                  props.close();
              }}
            />
          </Flex>

          <ScrollArea
            sx={{ flexGrow: 1 }}
            viewportProps={{ style: { padding: '1.0rem 1.5rem 5.0rem 1.5rem' } }}
          >
            <Stack>
              {props.children}
            </Stack>
          </ScrollArea>
        </Flex>
      </Flex>
    </SettingsModalContext.Provider>
  );
}


////////////////////////////////////////////////////////////
export function SettingsModalPanel(props: PropsWithChildren & { value: string }) {
  const { tab } = useContext(SettingsModalContext);
  const elem = useMemo(() => tab === props.value ? props.children : null, [tab, props.value]);
  return (<>{elem}</>);
}
SettingsModal.Panel = SettingsModalPanel;


////////////////////////////////////////////////////////////
type UnsavedChangesProps<T> = {
  /** Form that is used to detect if there are unsaved changes */
  form: UseFormReturnType<T>;
  /** Need initial values bc form reset func doesn't used updated intial values */
  initialValues: T;
  /** Cache key to recover changes when navigating away from settings */
  cacheKey?: string;
  /** Called when user resets changes */
  onReset?: (initialValues: T) => void;
  /** Called when user saves changes */
  onSave?: () => Promise<void>;
};

////////////////////////////////////////////////////////////
export function UnsavedChanges<T>({ form, ...props }: UnsavedChangesProps<T>) {
  const context = useContext(SettingsModalContext);
  const [loading, setLoading] = useState<boolean>(false);
  
  // Reset form values on change
  useEffect(() => {
    const cached = props.cacheKey ? popUnsaved(props.cacheKey) : null;

    if (cached) {
      // If cached unsaved values, then just set form values
      form.setValues(cached);
    }
    else if (!form.isDirty()) {
      // If no unsaved changes, apply initial values
      form.setValues(props.initialValues);
      form.resetDirty(props.initialValues);
    }
    else {
      // If have unsaved values, reset dirty initial state then set form value to a merged version
      form.setValues(merge({}, props.initialValues, form.values));
      form.resetDirty(props.initialValues);
    }
  }, [props.initialValues]);

  // Set context, notify when unsaved status change
  useEffect(() => {
    if (form.isDirty() && !context.hasUnsavedChanges)
      context.setHasUnsavedChanges(true);
    else if (!form.isDirty() && context.hasUnsavedChanges)
      context.setHasUnsavedChanges(false);
  }, [form.values]);


  return (
    <Transition mounted={context.bodyRef.current !== null && form.isDirty()} transition='pop-bottom-right' duration={200}>
      {(styles) => (
        <Affix target={context.bodyRef.current || undefined} position={{ bottom: '0.75rem', right: '1.0rem' }}>
          <Group
            spacing={8}
            w='30rem'
            p='0.5rem 0.5rem 0.5rem 0.8rem'
            sx={(theme) => ({
              backgroundColor: theme.colors.dark[8],
              boxShadow: '0px 0px 12px #00000030',
              borderRadius: theme.radius.sm,
              border: `1px solid ${context.highlightUnsaved ? theme.colors.red[5] : 'transparent'}`,
              '.tabler-icon': { color: theme.colors.dark[4], marginBottom: 1 },
            })}
            style={styles}
          >
            <IconAlertCircle size='1.5rem' />
            <Text ml={4}>You have unsaved changes</Text>
            <div style={{ flexGrow: 1 }} />

            <Button
              variant='default'
              onClick={() => {
                form.setValues(props.initialValues);
                form.resetDirty(props.initialValues);
                props.onReset?.(props.initialValues);
              }}
            >
              Reset
            </Button>
            <Button
              variant='gradient'
              loading={loading}
              onClick={async () => {
                if (!props.onSave) return;

                try {
                  setLoading(true);
                  await props.onSave();

                  // Reset dirty
                  form.resetDirty();
                  context.setHasUnsavedChanges(false);
                }
                finally {
                  setLoading(false);
                }
              }}
            >
              Save
            </Button>
          </Group>
        </Affix>
      )}
    </Transition>
  );
}
SettingsModal.Unsaved = UnsavedChanges;


/**
 * Cache a set of unsaved settings state (i.e. to switch to a modal submenu)
 * 
 * @param navkey The navigation key of the settings menu
 * @param values The form values
 */
export function pushUnsaved(navkey: string, values: any) {
  cache[`settings.${navkey}.unsaved`] = values;
}

/**
 * Get cached unsaved settings state.
 * 
 * @param navkey The navigation key of the settings menu
 * @returns The cached form values
 */
export function peekUnsaved(navkey: string) {
  return cache[`settings.${navkey}.unsaved`];
}

/**
 * Get cached unsaved settings state, and reset the cache value.
 * Does nothing if the cached value does not exist.
 * 
 * @param navkey The navigation key of the settings menu
 * @returns The cached form values
 */
export function popUnsaved(navkey: string) {
  const values = cache[`settings.${navkey}.unsaved`];
  if (values !== undefined)
    delete cache[`settings.${navkey}.unsaved`];
  return values;
}