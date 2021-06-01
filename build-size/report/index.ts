import { restoreCache } from '@actions/cache';
import { getInput, info, setFailed, warning } from '@actions/core';
import { promises as fs } from 'fs';
import { format } from 'util';
import { sendReport } from 'utils/sendReport';
import { createBuildSizeDiffReport } from '../utils/BuildSizeDiffReport';
import { getBuildSizes } from '../utils/BuildSizes';
import { getBuildSnapshotMeta } from '../utils/BuildSnapshotMeta';

async function getReportContent(
  dir: string,
  sha: string,
  label: string,
): Promise<string> {
  const meta = getBuildSnapshotMeta({ sha, label });

  info(format('Restoring cache from [%s, %s] keys', meta.key, meta.restoreKey));

  const restoredKey = await restoreCache([meta.filename], meta.key, [
    meta.restoreKey,
  ]);

  const currentSizes = await getBuildSizes(dir);

  if (!restoredKey) {
    warning(
      format(
        'Failed to restore cache from [%s, %s] keys',
        meta.key,
        meta.restoreKey,
      ),
    );

    return [
      '> Failed Failed to restore previous report cache.',
      createBuildSizeDiffReport(currentSizes, {}),
    ].join('\n');
  }

  if (restoredKey !== meta.key) {
    warning(
      format(
        'Failed to find latest key for sha "%s", using "%s" instead.',
        sha,
        restoredKey,
      ),
    );
  }

  const previousSizesJSON = await fs.readFile(meta.filename, 'utf-8');
  const previousSizes = JSON.parse(previousSizesJSON) as Record<string, number>;

  return createBuildSizeDiffReport(currentSizes, previousSizes);
}

async function main() {
  const pr = getInput('pr', { required: true });
  const dir = getInput('dir', { required: true });
  const sha = getInput('sha', { required: true });
  const label = getInput('label', { required: true });
  const token = getInput('token', { required: true });

  const content = await getReportContent(dir, sha, label);

  await sendReport({
    pr,
    label,
    token,
    content,
    title: 'Build Size Report',
  });
}

main().catch(setFailed);
