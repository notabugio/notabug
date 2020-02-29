// tslint:disable: no-var-requires
require('dotenv').config()
import { createGraphAdapter } from '@chaingun/http-adapter'
import { startup } from './startup'

startup(createGraphAdapter('http://localhost:4444/gun'))
