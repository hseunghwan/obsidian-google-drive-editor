import { fixtureFiles, fixtureVaultRoot } from './test/fixtures';
import { Workspace } from './ui/Workspace';

export default function App() {
  return (
    <Workspace
      root={fixtureVaultRoot}
      files={fixtureFiles}
      initialContent={`---
title: Home
---
# Home #daily

See [[Project Note]].`}
      onSave={() => undefined}
    />
  );
}
