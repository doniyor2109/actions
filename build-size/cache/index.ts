import { ReserveCacheError, restoreCache, saveCache } from '@actions/cache';
import { getInput, group, info, setFailed, warning } from '@actions/core';
import { promises as fs } from 'fs';
import { getBuildSizes } from '../utils/BuildSizes';
import { getBuildSnapshotMeta } from '../utils/BuildSnapshotMeta';

const dir = getInput('dir', { required: true });
const sha = getInput('sha', { required: true });
const label = getInput('label', { required: true });

main().catch(setFailed);

async function main() {
  const meta = getBuildSnapshotMeta({ sha, label });

  info(`Checking cache for the: ${meta.key}`);

  const restoredKey = await restoreCache([meta.filename], meta.key);

  if (restoredKey) {
    info('Cache hit, finishing the job…');
    return;
  }

  await group(`Computing build size for the: ${dir}`, async () => {
    const sizes = await getBuildSizes(dir);
    info(`Computed file sizes:\n${JSON.stringify(sizes, null, 2)}`);

    info(`Writing build size report to: ${meta.filename}`);
    await fs.writeFile(meta.filename, JSON.stringify(sizes), 'utf-8');

    try {
      info(`Caching report to: ${meta.key}`);
      await saveCache([meta.filename], meta.key);
    } catch (error: unknown) {
      if (error instanceof ReserveCacheError) {
        warning(error);
      } else {
        throw error;
      }
    }
  });
}
