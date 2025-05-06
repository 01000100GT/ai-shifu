import {
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
import { SelectedOption } from './type'
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
        detail: { type: this.type, content: span.textContent }
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

export {
    profilePlaceholders,
    imgPlaceholders,
    videoPlaceholders,
    createSlashCommands
}