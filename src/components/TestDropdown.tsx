import { useState } from 'react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { MoreHorizontal } from 'lucide-react';

export function TestDropdown() {
  const [message, setMessage] = useState('No action yet');
  
  return (
    <div className="p-8 space-y-4">
      <h2 className="text-xl font-bold">Dropdown Test Component</h2>
      <p>Message: {message}</p>
      
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-medium mb-2">Test 1: Basic Dropdown with Button trigger</h3>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                Open Menu (with asChild)
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setMessage('Option 1 clicked!')}>
                Option 1
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setMessage('Option 2 clicked!')}>
                Option 2
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div>
          <h3 className="text-sm font-medium mb-2">Test 2: Dropdown without asChild</h3>
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-8 px-4 py-2 border">
              Open Menu (no asChild)
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setMessage('Option A clicked!')}>
                Option A
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setMessage('Option B clicked!')}>
                Option B
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div>
          <h3 className="text-sm font-medium mb-2">Test 3: Icon button (like in the app)</h3>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setMessage('Edit clicked!')}>
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setMessage('Delete clicked!')}>
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}