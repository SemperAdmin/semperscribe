/**
 * Modern Paragraph Editor Component
 * Demonstrates improved UI/UX for paragraph management
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Textarea } from './ui/textarea';
import { 
  Mic, 
  MicOff, 
  Trash2, 
  Plus, 
  ChevronUp, 
  ChevronDown, 
  Eraser
} from 'lucide-react';

interface ParagraphData {
  id: number;
  level: number;
  content: string;
  isMandatory?: boolean;
  title?: string;
}

interface ModernParagraphEditorProps {
  paragraph: ParagraphData;
  index: number;
  citation: string;
  isListening: boolean;
  onContentChange: (id: number, content: string) => void;
  onVoiceInput: (id: number) => void;
  onClearContent: (id: number) => void;
  onAddParagraph: (type: 'main' | 'sub' | 'same' | 'up', afterId: number) => void;
  onRemoveParagraph: (id: number) => void;
  onMoveParagraph: (id: number, direction: 'up' | 'down') => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  placeholder?: string;
}

export const ModernParagraphEditor: React.FC<ModernParagraphEditorProps> = ({
  paragraph,
  index,
  citation,
  isListening,
  onContentChange,
  onVoiceInput,
  onClearContent,
  onAddParagraph,
  onRemoveParagraph,
  onMoveParagraph,
  canMoveUp,
  canMoveDown,
  placeholder = "Enter paragraph content..."
}) => {
  const [isFocused, setIsFocused] = useState(false);

  const getLevelColor = (level: number) => {
    const colors = {
      1: 'bg-blue-100 border-blue-300 text-blue-800',
      2: 'bg-yellow-100 border-yellow-300 text-yellow-800',
      3: 'bg-green-100 border-green-300 text-green-800',
      4: 'bg-purple-100 border-purple-300 text-purple-800',
      5: 'bg-pink-100 border-pink-300 text-pink-800',
    };
    return colors[level as keyof typeof colors] || 'bg-gray-100 border-gray-300 text-gray-800';
  };

  const getTitleBadgeColor = (isMandatory?: boolean) => {
    return isMandatory ? 'bg-blue-500 text-white' : 'bg-green-500 text-white';
  };

  return (
    <Card 
      className={`
        transition-all duration-300 border-l-4
        ${paragraph.level === 1 ? 'border-l-blue-500' :
          paragraph.level === 2 ? 'border-l-yellow-500' :
          paragraph.level === 3 ? 'border-l-green-500' :
          paragraph.level === 4 ? 'border-l-purple-500' : 'border-l-gray-500'}
        ${isFocused ? 'ring-2 ring-blue-200 shadow-md' : 'shadow-sm'}
        hover:shadow-md
      `}
      style={{ marginLeft: `${(paragraph.level - 1) * 24}px` }}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {/* Level Badge */}
            <Badge 
              variant="outline" 
              className={`text-xs ${getLevelColor(paragraph.level)}`}
            >
              Level {paragraph.level} • {citation}
            </Badge>

            {/* Title Badge */}
            {paragraph.title && (
              <Badge className={getTitleBadgeColor(paragraph.isMandatory)}>
                {paragraph.title}
              </Badge>
            )}
          </div>

          {/* Movement Controls */}
          <div className="flex items-center space-x-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onMoveParagraph(paragraph.id, 'up')}
              disabled={!canMoveUp}
              className="h-8 w-8 p-0"
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onMoveParagraph(paragraph.id, 'down')}
              disabled={!canMoveDown}
              className="h-8 w-8 p-0"
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Textarea */}
        <div className="relative">
          <Textarea
            value={paragraph.content}
            onChange={(e) => onContentChange(paragraph.id, e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={placeholder}
            className="min-h-[100px] resize-none focus:ring-2 focus:ring-blue-500"
          />
          
          {/* Character Count */}
          <div className="absolute bottom-2 right-2 text-xs text-gray-400">
            {paragraph.content.length} chars
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          {/* Voice Input */}
          <Button
            variant={isListening ? "destructive" : "default"}
            size="sm"
            onClick={() => onVoiceInput(paragraph.id)}
            className={`
              flex items-center space-x-2 transition-all duration-300
              ${isListening ? 'animate-pulse' : ''}
            `}
          >
            {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            <span>{isListening ? 'Stop Recording' : 'Voice Input'}</span>
          </Button>

          {/* Clear Content */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onClearContent(paragraph.id)}
            disabled={!paragraph.content.trim()}
            className="flex items-center space-x-2"
          >
            <Eraser className="h-4 w-4" />
            <span>Clear</span>
          </Button>

          {/* Add Paragraph Buttons */}
          <div className="flex space-x-1">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onAddParagraph('main', paragraph.id)}
              className="flex items-center space-x-1"
            >
              <Plus className="h-4 w-4" />
              <span>Main</span>
            </Button>

            {paragraph.level < 8 && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onAddParagraph('sub', paragraph.id)}
                className="flex items-center space-x-1"
              >
                <Plus className="h-4 w-4" />
                <span>Sub</span>
              </Button>
            )}

            {paragraph.level > 1 && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onAddParagraph('same', paragraph.id)}
                className="flex items-center space-x-1"
              >
                <Plus className="h-4 w-4" />
                <span>Same</span>
              </Button>
            )}
          </div>

          {/* Delete Button */}
          {(!paragraph.isMandatory || paragraph.title === 'Cancellation') && paragraph.id !== 1 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => onRemoveParagraph(paragraph.id)}
              className="flex items-center space-x-2 ml-auto"
            >
              <Trash2 className="h-4 w-4" />
              <span>Delete</span>
            </Button>
          )}
        </div>

        {/* Status Messages */}
        {isListening && (
          <div className="flex items-center space-x-2 text-sm text-red-600 bg-red-50 p-2 rounded-md">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="font-medium">Listening... Speak now</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};