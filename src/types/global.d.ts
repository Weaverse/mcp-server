
type ArticleRefType = {
    title: string
    description: string
    order: number
    slug: string
    content: string
  }
  
type DocsReference = {
    title: string
    order: number
    description: string
    content: string
    headings: ArticleRefType[]
    slug: string
  }[]