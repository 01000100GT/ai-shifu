'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import {
  autocompletion,
  type CompletionContext,
  type CompletionResult
} from '@codemirror/autocomplete'
import {
  EditorView,
  Decoration,
  DecorationSet,
  ViewPlugin,
  ViewUpdate,
  MatchDecorator,
  WidgetType
} from '@codemirror/view'
import CustomDialog from './components/custom-dialog'
import EditorContext from './editor-context'
import type { Profile } from '@/components/profiles/type'
import ImageInject from './components/image-inject'
import VideoInject from './components/video-inject'
import ProfileInject from './components/profile-inject'
import { SelectedOption, IEditorContext } from './type'
import { useTranslation } from 'react-i18next'

import './index.css'

class PlaceholderWidget extends WidgetType {
  constructor (
    private name: string,
    private styleClass: string,
    private type: SelectedOption
  ) {
    super()
  }

  toDOM () {
    const span = document.createElement('span')
    span.className = this.styleClass
    span.textContent = `${this.name}`
    span.addEventListener('click', () => {
      const event = new CustomEvent('globalTagClick', {
        detail: { type: this.type }
      })
      window.dispatchEvent(event)
    })
    return span
  }

  ignoreEvent () {
    return false
  }
}

const profileMatcher = new MatchDecorator({
  regexp: /(\{\w+\})/g,
  decoration: match =>
    Decoration.replace({
      widget: new PlaceholderWidget(
        match[1],
        'tag-profile',
        SelectedOption.Profile
      )
    })
})

const imageUrlMatcher = new MatchDecorator({
  regexp:
    /(https?:\/\/(?:avtar\.agiclass\.cn)\S+(?:\.(?:png|jpg|jpeg|gif|bmp))?)/g,
  decoration: match =>
    Decoration.replace({
      widget: new PlaceholderWidget(match[1], 'tag-image', SelectedOption.Image)
    })
})

const bilibiliUrlMatcher = new MatchDecorator({
  regexp: /(https?:\/\/(?:www\.|m\.)?bilibili\.com\/video\/\S+)/g,
  decoration: match =>
    Decoration.replace({
      widget: new PlaceholderWidget(match[1], 'tag-video', SelectedOption.Video)
    })
})

const profilePlaceholders = ViewPlugin.fromClass(
  class {
    placeholders: DecorationSet
    constructor (view: EditorView) {
      this.placeholders = profileMatcher.createDeco(view)
    }
    update (update: ViewUpdate) {
      this.placeholders = profileMatcher.updateDeco(update, this.placeholders)
    }
  },
  {
    decorations: instance => instance.placeholders,
    provide: plugin =>
      EditorView.atomicRanges.of(view => {
        return view.plugin(plugin)?.placeholders || Decoration.none
      })
  }
)

const imgPlaceholders = ViewPlugin.fromClass(
  class {
    placeholders: DecorationSet
    constructor (view: EditorView) {
      this.placeholders = imageUrlMatcher.createDeco(view)
    }
    update (update: ViewUpdate) {
      this.placeholders = imageUrlMatcher.updateDeco(update, this.placeholders)
    }
  },
  {
    decorations: instance => instance.placeholders,
    provide: plugin =>
      EditorView.atomicRanges.of(view => {
        return view.plugin(plugin)?.placeholders || Decoration.none
      })
  }
)

const videoPlaceholders = ViewPlugin.fromClass(
  class {
    placeholders: DecorationSet
    constructor (view: EditorView) {
      this.placeholders = bilibiliUrlMatcher.createDeco(view)
    }
    update (update: ViewUpdate) {
      this.placeholders = bilibiliUrlMatcher.updateDeco(
        update,
        this.placeholders
      )
    }
  },
  {
    decorations: instance => instance.placeholders,
    provide: plugin =>
      EditorView.atomicRanges.of(view => {
        return view.plugin(plugin)?.placeholders || Decoration.none
      })
  }
)

function createSlashCommands (
  onSelectOption: (selectedOption: SelectedOption) => void
) {
  return (context: CompletionContext): CompletionResult | null => {
    const { t } = useTranslation();
    const word = context.matchBefore(/\/(\w*)$/)
    if (!word) return null

    const handleSelect = (
      view: EditorView,
      _: any,
      from: number,
      to: number,
      selectedOption: SelectedOption
    ) => {
      view.dispatch({
        changes: { from, to, insert: '' }
      })
      onSelectOption(selectedOption)
    }

    return {
      from: word.from,
      to: word.to,
      options: [
        {
          label: t('cm-editor.variable'),
          apply: (view, _, from, to) => {
            handleSelect(view, _, from, to, SelectedOption.Profile)
          }
        },
        {
          label: t('cm-editor.image'),
          apply: (view, _, from, to) => {
            handleSelect(view, _, from, to, SelectedOption.Image)
          }
        },
        {
          label: t('cm-editor.video'),
          apply: (view, _, from, to) => {
            handleSelect(view, _, from, to, SelectedOption.Video)
          }
        }
      ],
      filter: false
    }
  }
}

type EditorProps = {
  content?: string
  isEdit?: boolean
  profiles?: string[]
  onChange?: (value: string, isEdit: boolean) => void
}

const Editor: React.FC<EditorProps> = ({
  content = '',
  isEdit,
  profiles = [],
  onChange
}) => {
  const { t } = useTranslation();
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedOption, setSelectedOption] = useState<SelectedOption>(
    SelectedOption.Empty
  )
  const [profileList, setProfileList] = useState<string[]>(profiles)
  const editorViewRef = useRef<EditorView | null>(null)

  const editorContextValue: IEditorContext = {
    selectedOption: SelectedOption.Empty,
    setSelectedOption,
    dialogOpen,
    setDialogOpen,
    profileList,
    setProfileList
  }

  const onSelectedOption = useCallback((selectedOption: SelectedOption) => {
    setDialogOpen(true)
    setSelectedOption(selectedOption)
  }, [])

  const insertTextAsTag = useCallback(
    (text: string) => {
      if (!editorViewRef.current) return

      const { state, dispatch } = editorViewRef.current
      const from = state.selection.main.from

      dispatch({
        changes: { from, insert: text },
        selection: { anchor: from + text.length }
      })
    },
    [editorViewRef]
  )

  const handleSelectProfile = useCallback(
    (profile: Profile) => {
      const textToInsert = `{${profile.profile_key}}`
      insertTextAsTag(textToInsert)
      setDialogOpen(false)
    },
    [insertTextAsTag, selectedOption]
  )

  const handleSelectResource = useCallback(
    (resourceUrl: string) => {
      const textToInsert = ` ${resourceUrl} `
      insertTextAsTag(textToInsert)
      setDialogOpen(false)
    },
    [insertTextAsTag, selectedOption]
  )

  const slashCommandsExtension = useCallback(() => {
    return autocompletion({
      override: [createSlashCommands(onSelectedOption)]
    })
  }, [onSelectedOption])

  const handleEditorUpdate = useCallback((view: EditorView) => {
    editorViewRef.current = view
  }, [])

  const handleTagClick = useCallback(
    (event: any) => {
      const { type } = event.detail
      setSelectedOption(type)
      setDialogOpen(true)
    },
    [setSelectedOption, setDialogOpen]
  )

  useEffect(() => {
    window.addEventListener('globalTagClick', handleTagClick)

    return () => {
      window.removeEventListener('globalTagClick', handleTagClick)
    }
  }, [handleTagClick])

  return (
    <>
      <EditorContext.Provider value={editorContextValue}>
        {isEdit ? (
          <>
            <CodeMirror
              extensions={[
                EditorView.lineWrapping,
                slashCommandsExtension(),
                profilePlaceholders,
                imgPlaceholders,
                videoPlaceholders,
                EditorView.updateListener.of(update => {
                  handleEditorUpdate(update.view)
                })
              ]}
              basicSetup={{
                lineNumbers: false,
                syntaxHighlighting: false,
                highlightActiveLine: false,
                highlightActiveLineGutter: false,
                foldGutter: false
              }}
              className='border rounded-md'
              placeholder={t('cm-editor.input-slash-to-insert-content')}
              value={content}
              theme='light'
              height='10em'
              onChange={(value: string) => {
                onChange?.(value, isEdit || false)
              }}
            />
            <CustomDialog>
              {selectedOption === SelectedOption.Profile && (
                <ProfileInject onSelect={handleSelectProfile} />
              )}
              {selectedOption === SelectedOption.Image && (
                <ImageInject onSelect={handleSelectResource} />
              )}
              {selectedOption === SelectedOption.Video && (
                <VideoInject onSelect={handleSelectResource} />
              )}
            </CustomDialog>
          </>
        ) : (
          <div className='w-full p-2 rounded cursor-pointer font-mono'>
            {content}
          </div>
        )}
      </EditorContext.Provider>
    </>
  )
}
export default Editor
