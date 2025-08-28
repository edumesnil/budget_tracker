"use client"

import { useState, useMemo } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { Check } from "lucide-react"
import { iconNames, iconCategories, commonIcons, getIconByName } from "@/utils/icons"

type IconSelectorProps = {
  value: string
  onValueChange: (value: string) => void
  color: string
}

export function IconSelector({ value, onValueChange, color }: IconSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("")

  // Filter icons based on search query
  const filteredIcons = useMemo(() => {
    if (!searchQuery) return iconNames
    return iconNames.filter((name) => name.toLowerCase().includes(searchQuery.toLowerCase()))
  }, [searchQuery])

  // Filter common icons
  const availableCommonIcons = useMemo(() => {
    return commonIcons.filter((icon) => iconNames.includes(icon))
  }, [])

  // Render an icon component
  const renderIcon = (iconName: string) => {
    const IconComponent = getIconByName(iconName)
    return <IconComponent size={16} color={color} />
  }

  return (
    <div className="flex flex-col">
      <div className="p-2">
        <Input
          placeholder="Search icons..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="mb-2"
        />
      </div>

      <ScrollArea className="pr-2" style={{ height: "350px" }}>
        {/* Common Icons */}
        {!searchQuery && (
          <div className="mb-3">
            <h3 className="text-sm font-medium text-muted-foreground px-4 mb-1">Common Icons</h3>
            <div className="grid grid-cols-8 gap-1 p-2">
              {availableCommonIcons.map((iconName) => (
                <div
                  key={`common-${iconName}`}
                  onClick={() => onValueChange(iconName)}
                  className="flex items-center justify-center cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
                  title={iconName}
                >
                  <div className="relative p-1.5">
                    <div
                      className="flex items-center justify-center h-8 w-8 rounded-md"
                      style={{ backgroundColor: `${color}15`, color: color }}
                    >
                      {renderIcon(iconName)}
                    </div>
                    {value === iconName && (
                      <div className="absolute -top-1 -right-1 bg-primary rounded-full p-0.5">
                        <Check className="h-2 w-2 text-primary-foreground" />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Search Results */}
        {searchQuery && (
          <div className="mb-3">
            <h3 className="text-sm font-medium text-muted-foreground px-4 mb-1">Search Results</h3>
            <div className="grid grid-cols-8 gap-1 p-2">
              {filteredIcons.length > 0 ? (
                filteredIcons.map((iconName) => (
                  <div
                    key={`search-${iconName}`}
                    onClick={() => onValueChange(iconName)}
                    className="flex items-center justify-center cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
                    title={iconName}
                  >
                    <div className="relative p-1.5">
                      <div
                        className="flex items-center justify-center h-8 w-8 rounded-md"
                        style={{ backgroundColor: `${color}15`, color: color }}
                      >
                        {renderIcon(iconName)}
                      </div>
                      {value === iconName && (
                        <div className="absolute -top-1 -right-1 bg-primary rounded-full p-0.5">
                          <Check className="h-2 w-2 text-primary-foreground" />
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-8 py-6 text-center text-sm text-muted-foreground">No matching icons found</div>
              )}
            </div>
          </div>
        )}

        {/* Categorized Icons */}
        {!searchQuery && (
          <>
            {iconCategories.map((category) => (
              <div key={category.name} className="mb-3">
                <h3 className="text-sm font-medium text-muted-foreground px-4 mb-1">{category.name}</h3>
                <div className="grid grid-cols-8 gap-1 p-2">
                  {category.icons.map((iconName) => (
                    <div
                      key={`${category.name}-${iconName}`}
                      onClick={() => onValueChange(iconName)}
                      className="flex items-center justify-center cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
                      title={iconName}
                    >
                      <div className="relative p-1.5">
                        <div
                          className="flex items-center justify-center h-8 w-8 rounded-md"
                          style={{ backgroundColor: `${color}15`, color: color }}
                        >
                          {renderIcon(iconName)}
                        </div>
                        {value === iconName && (
                          <div className="absolute -top-1 -right-1 bg-primary rounded-full p-0.5">
                            <Check className="h-2 w-2 text-primary-foreground" />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
      </ScrollArea>
    </div>
  )
}

