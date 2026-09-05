import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trash2, UserPlus } from 'lucide-react';

interface POCManagerProps {
  pocs: string[];
  onChange: (pocs: string[]) => void;
}

export function POCManager({ pocs, onChange }: POCManagerProps) {
  // We'll manage local state for the "Add New POC" form
  const [name, setName] = useState('');
  const [rank, setRank] = useState('');
  const [unit, setUnit] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  const addPOC = () => {
    if (!name) return; // At minimum need a name

    // Format: NAME/RANK/UNIT/TEL: NUMBER/EMAIL: ADDRESS
    // We filter out empty fields to avoid extra slashes
    const parts: string[] = [];

    if (name.trim()) parts.push(name.toUpperCase());
    if (rank.trim()) parts.push(rank.toUpperCase());
    if (unit.trim()) parts.push(unit.toUpperCase());
    if (phone.trim()) {
      parts.push(phone.toUpperCase().startsWith('TEL:') ? phone.toUpperCase() : `TEL: ${phone.toUpperCase()}`);
    }

    // Build POC string
    let pocString = parts.join('/');

    // Handle email - may need to wrap to next line if too long (per legacy behavior)
    if (email.trim()) {
      const emailPart = email.toUpperCase().startsWith('EMAIL:') ? email.toUpperCase() : `EMAIL: ${email.toUpperCase()}`;
      if ((pocString + '/' + emailPart).length > 65) {
        pocString += '\n' + emailPart;
      } else {
        pocString += '/' + emailPart;
      }
    }

    onChange([...pocs, pocString]);

    // Reset form
    setName('');
    setRank('');
    setUnit('');
    setPhone('');
    setEmail('');
  };

  const removePOC = (index: number) => {
    const newPocs = pocs.filter((_, i) => i !== index);
    onChange(newPocs);
  };

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between py-4">
        <CardTitle as="h3" className="text-lg">Points of Contact (POC)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {/* Input Form */}
        <div className="space-y-4 p-4 border rounded-lg bg-muted/20">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="poc-rank" className="text-xs">Rank/Grade</Label>
              <Input
                id="poc-rank"
                placeholder="MSGT"
                value={rank}
                onChange={(e) => setRank(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="poc-name" className="text-xs">Name (LAST, FIRST)</Label>
              <Input
                id="poc-name"
                placeholder="MORALES, J. K."
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="poc-unit" className="text-xs">Unit/Office</Label>
              <Input
                id="poc-unit"
                placeholder="MRA/MPE"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="poc-phone" className="text-xs">Phone</Label>
              <Input
                id="poc-phone"
                placeholder="(703)784-6164"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-3 space-y-2">
              <Label htmlFor="poc-email" className="text-xs">Email</Label>
              <Input
                id="poc-email"
                placeholder="FIRSTNAME.LASTNAME@USMC.MIL"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={addPOC} className="w-full gap-2" disabled={!name}>
                <UserPlus className="h-4 w-4" /> Add POC
              </Button>
            </div>
          </div>
        </div>

        {/* List */}
        <div className="space-y-2">
          {pocs.length === 0 && (
            <div className="text-center text-muted-foreground py-2 text-sm">
              No points of contact added.
            </div>
          )}
          
          {pocs.map((poc, index) => (
            <div key={index} className="flex items-center justify-between p-3 border rounded bg-card/50 font-mono text-sm">
              <span>{poc}</span>
              <Button variant="ghost" size="sm" onClick={() => removePOC(index)} className="text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
