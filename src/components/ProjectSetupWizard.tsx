import { useEffect, useState } from 'react';
import { ManifestPicker, buildManifestFromSelections } from './ManifestPicker';
import { readManifest, writeManifest } from '../lib/tauri';
import type { Manifest } from '../types/manifest';

interface ProjectSetupWizardProps {
  projectRoot: string;
  mode?: 'first-load' | 'reconfigure' | 'diff';
  onComplete: () => void;
  onCancel: () => void;
}

export function ProjectSetupWizard({ projectRoot, mode = 'first-load', onComplete, onCancel }: ProjectSetupWizardProps) {
  const [existing, setExisting] = useState<Manifest | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    readManifest(projectRoot)
      .then((m) => { if (!cancelled) setExisting(m); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [projectRoot]);

  if (loading) return null;

  const initialFiles = existing?.components.flatMap((c) => c.variants.map((v) => v.file)) ?? [];

  return (
    <ManifestPicker
      projectRoot={projectRoot}
      mode={existing ? mode : 'first-load'}
      existing={{ selectedFiles: initialFiles }}
      onCancel={onCancel}
      onSave={async (selectedRelative) => {
        const manifest = buildManifestFromSelections(selectedRelative, existing);
        await writeManifest(projectRoot, manifest);
        onComplete();
      }}
    />
  );
}
