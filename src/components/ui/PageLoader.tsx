/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Loader2 } from 'lucide-react';

export default function PageLoader() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}
